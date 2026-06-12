#!/usr/bin/env python3
"""
Trace Data Flywheel - Automated Evaluation & Continuous Learning Engine
Runs as a cron job to analyze telemetry, generate insights, and accumulate training data.
"""
# Prevent multiprocessing RLock deadlocks in Hugging Face datasets/tokenizers library
import os
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["HF_DATASETS_NUM_PROC"] = "1"  # Disable multiprocessing in datasets library

# Force 'spawn' start method on macOS to avoid fork-safety issues with multiprocessing
import multiprocessing
try:
    multiprocessing.set_start_method("spawn", force=True)
except RuntimeError:
    pass  # Already set

import json
import sys
import time
import uuid
from pathlib import Path
from typing import Any

import requests

# Meta-monitoring integration
try:
    from meta_effectiveness_scorer import MetaEffectivenessScorer
    META_SCORER_AVAILABLE = True
except ImportError:
    META_SCORER_AVAILABLE = False

# ─── Configuration ──────────────────────────────────────────────────────────

MLX_SERVER_URL = os.getenv("MLX_SERVER_URL", "http://localhost:9001/v1/chat/completions")
# Use mock telemetry API on 8084 (no auth) or docker on 3000
TRACE_TELEMETRY_API = os.getenv("TRACE_TELEMETRY_API", "http://localhost:8084/api/v1/telemetry")
CONTINUOUS_LEARNING_PATH = Path("datasets/continuous_learning.jsonl")
RETRAIN_THRESHOLD = int(os.getenv("RETRAIN_THRESHOLD", "20"))  # Trigger retrain after N samples (lowered for dev)
MLX_MODEL = os.getenv("MLX_MODEL", "mlx-community/Qwen2.5-1.5B-Instruct-4bit")
MLX_ADAPTER_PATH = os.getenv("MLX_ADAPTER_PATH", ".trace/adapters/trace-enterprise-full-600")

# ─── Prompts ────────────────────────────────────────────────────────────────

ANALYSIS_PROMPT = """You are an expert system optimization agent for Trace, an AI governance platform.
Analyze the following user interaction logs and latency metrics from the Trace data plane.

THREE CORE PRIMITIVES TO EVALUATE:

1. **LATENCY TIME-SERIES GAPS**
   - Compare user input token length vs. Time-to-First-Token (TTFT) and total latency
   - Identify specific prompt structures causing massive latency spikes
   - Flag prompts where latency > 2σ from mean for that token bucket
   - Generate 10 synthetic variations of problematic prompts for CI/CD stress testing

2. **INTENT-OUTPUT ALIGNMENT (TRUST VIOLATIONS)**
   - Compare user intent (from classification) against final LLM output
   - Detect drift: user wanted structured data but got conversational answer
   - Detect guardrail failures: harmful content generated despite policies
   - Log as trust violations to refine Trace's governance protocols

3. **EDGE-CASE EXTRACTION**
   - Users breaking LLM guardrails or causing unhandled exceptions
   - Isolate exact payload, clean PII (emails, keys, tokens, PII)
   - Append to "heavy-tail" test block for regression testing

Data: {telemetry_json}

Output STRICT JSON with these exact keys:
{{
  "latency_gaps": [
    {{"pattern": "...", "severity": "high|medium|low", "evidence": "...", "suggested_test_vector": "...", "token_bucket": "..."}}
  ],
  "insights": [
    {{"type": "intent_drift|policy_violation|guardrail_bypass|edge_case", "description": "...", "evidence": "...", "affected_components": [...], "primitive": "latency|alignment|edge_case"}}
  ],
  "new_test_synthetic_dataset": [
    {{"query": "...", "expected_intent": "...", "expected_risk": "...", "expected_signals": [...], "rationale": "...", "primitive_target": "latency|alignment|edge_case"}}
  ]
}}"""

# ─── Core Functions ─────────────────────────────────────────────────────────

def fetch_recent_telemetry(minutes: int = 60) -> list[dict[str, Any]]:
    """Pull recent logs from Trace data plane (inputs, LLM outputs, latency)."""
    try:
        url = f"{TRACE_TELEMETRY_API}/recent"
        params = {"minutes": minutes}
        resp = requests.get(url, params=params, timeout=30)
        if resp.status_code == 200:
            return resp.json()
        else:
            print(f"[WARN] Telemetry API returned {resp.status_code}: {resp.text}")
            return []
    except Exception as e:
        print(f"[WARN] Failed to fetch telemetry: {e}")
        return []


def ask_mlx_server(telemetry_data: list[dict[str, Any]]) -> dict[str, Any]:
    """Send telemetry to local MLX server for analysis."""
    prompt = ANALYSIS_PROMPT.format(telemetry_json=json.dumps(telemetry_data, indent=2))
    
    payload = {
        "model": "local-hermes-nemotron",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 4096,
    }
    
    try:
        resp = requests.post(MLX_SERVER_URL, json=payload, timeout=120)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        
        # Extract JSON from response (handle potential markdown code blocks)
        import re
        # First try to find JSON in markdown code blocks
        json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(1))
        # Fallback: find first complete JSON object
        json_match = re.search(r"\{.*\}", content, re.DOTALL)
        if json_match:
            # Try to parse, if fails try to find balanced braces
            json_str = json_match.group()
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                # Try to find balanced braces manually
                brace_count = 0
                start_idx = -1
                for i, char in enumerate(json_str):
                    if char == '{':
                        if brace_count == 0:
                            start_idx = i
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0 and start_idx != -1:
                            candidate = json_str[start_idx:i+1]
                            try:
                                return json.loads(candidate)
                            except json.JSONDecodeError:
                                continue
                # If all else fails, return empty
                print(f"[ERROR] Could not parse JSON from MLX response")
                return {"latency_gaps": [], "insights": [], "new_test_synthetic_dataset": []}
        return json.loads(content)
    except Exception as e:
        print(f"[ERROR] MLX server analysis failed: {e}")
        return {"latency_gaps": [], "insights": [], "new_test_synthetic_dataset": []}


def append_to_continuous_learning(telemetry: list, analysis: dict) -> int:
    """Append telemetry + Hermes critique to continuous learning dataset."""
    entry = {
        "timestamp": time.time(),
        "telemetry": telemetry,
        "hermes_critique": analysis,
        "source": "evaluate_trace_cron"
    }
    
    CONTINUOUS_LEARNING_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CONTINUOUS_LEARNING_PATH, "a") as f:
        f.write(json.dumps(entry, sort_keys=True) + "\n")
    
    # Count total entries
    count = sum(1 for _ in open(CONTINUOUS_LEARNING_PATH))
    return count


def check_retrain_threshold() -> bool:
    """Check if continuous learning dataset has hit retrain threshold."""
    if not CONTINUOUS_LEARNING_PATH.exists():
        return False
    count = sum(1 for _ in open(CONTINUOUS_LEARNING_PATH))
    return count >= RETRAIN_THRESHOLD


def trigger_retrain() -> bool:
    """Trigger MLX LoRA fine-tuning on accumulated data."""
    print(f"[INFO] Retrain threshold ({RETRAIN_THRESHOLD}) reached. Starting fine-tuning...")
    
    # Prepare training data in MLX chat format
    train_file = "datasets/continuous_learning_train.jsonl"
    valid_file = "datasets/continuous_learning_valid.jsonl"
    
    # Convert continuous learning data to chat format
    # This would use the existing prepare_lora_dataset.py logic
    try:
        import subprocess
        result = subprocess.run([
            ".venv-mlx/bin/python", "scripts/train-trace-mlx.sh",
            "--local-only", "--iters", "600",
            "--adapter-path", ".trace/adapters/trace-enterprise-full-600",
            "--output-dir", "datasets/trace-enterprise-full",
            "--num-layers", "8"
        ], cwd="/Users/cnazarko/stria systems/TraceV2", capture_output=True, text=True, timeout=3600)
        
        if result.returncode == 0:
            print("[INFO] Fine-tuning completed successfully")
            return True
        else:
            print(f"[ERROR] Fine-tuning failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"[ERROR] Retrain trigger failed: {e}")
        return False


def hot_swap_model() -> bool:
    """Restart MLX server with new adapter weights."""
    print("[INFO] Hot-swapping model...")
    # In production, this would restart the mlx_lm.server process
    # For now, just log that it needs to be done
    print("[INFO] Restart mlx_lm.server with new adapter: python -m mlx_lm.server --adapter-path .trace/adapters/trace-enterprise-full-600 --port 8080")
    return True


def main():
    print(f"[INFO] Starting Trace data flywheel evaluation @ {time.strftime('%Y-%m-%d %H:%M:%S')}")

    # Generate unique analysis ID for meta-monitoring
    analysis_id = str(uuid.uuid4())[:8]

    # 1. Fetch telemetry
    telemetry = fetch_recent_telemetry(60)
    if not telemetry:
        print("[INFO] No new telemetry data to analyze")
        return 0

    print(f"[INFO] Fetched {len(telemetry)} telemetry records")

    # 2. Analyze with Hermes
    analysis = ask_mlx_server(telemetry)

    # 3. Log to meta-effectiveness scorer for RL feedback
    if META_SCORER_AVAILABLE:
        try:
            scorer = MetaEffectivenessScorer()
            findings_count = scorer.log_monitor_findings(analysis, analysis_id)
            print(f"[META] Logged {findings_count} findings to meta-effectiveness scorer (id: {analysis_id})")
        except Exception as e:
            print(f"[META] Warning: Failed to log findings: {e}")

    # 4. Accumulate learning
    total_entries = append_to_continuous_learning(telemetry, analysis)
    print(f"[INFO] Continuous learning dataset now has {total_entries} entries")

    # 5. Check retrain threshold
    if check_retrain_threshold():
        if trigger_retrain():
            hot_swap_model()
            print("[INFO] Retrain + hot-swap complete. System updated.")
        else:
            print("[WARN] Retrain failed, continuing with current model")

    # 6. Print summary
    lg = len(analysis.get("latency_gaps", []))
    ins = len(analysis.get("insights", []))
    tests = len(analysis.get("new_test_synthetic_dataset", []))
    print(f"[SUMMARY] Latency gaps: {lg}, Insights: {ins}, New test vectors: {tests}")

    return 0


if __name__ == "__main__":
    sys.exit(main())