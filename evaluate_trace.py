#!/usr/bin/env python3
"""
Data Flywheel: Evaluation & Optimization Loop for Trace.
Pulls telemetry from Trace data plane, analyzes with Hermes (local MLX),
generates new test vectors, and accumulates continuous learning dataset.

Run via cron: 0 * * * * /path/to/.venv-mlx/bin/python /path/to/evaluate_trace.py
"""
import json
import os
import re
import time
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, asdict

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ─── Configuration ──────────────────────────────────────────────────────────

MLX_SERVER_URL = "http://localhost:9001/v1/chat/completions"
TRACE_TELEMETRY_API = os.getenv("TRACE_TELEMETRY_API", "http://localhost:8084/api/v1/telemetry")
MLX_ANALYSIS_MODEL = "local-hermes-base"
CONTINUOUS_LEARNING_PATH = Path("datasets/continuous_learning_dataset.jsonl")
TELEMETRY_CACHE_PATH = Path("datasets/telemetry_cache.jsonl")
TELEMETRY_LOOKBACK_MINUTES = 60
MIN_TELEMETRY_SAMPLES = 5
MAX_TOKENS_ANALYSIS = 2048
TEMPERATURE = 0.2

# PII patterns for cleaning
PII_PATTERNS = [
    (r'\b\d{3}-\d{2}-\d{4}\b', '[SSN]'),  # SSN
    (r'\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b', '[CREDIT_CARD]'),  # Credit card
    (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]'),  # Email
    (r'\b(?:password|secret|token|api_key|access_key|bearer)\s*[=:]\s*\S+\b', '[CREDENTIAL]', re.IGNORECASE),
    (r'\bsk-[a-zA-Z0-9]{48}\b', '[OPENAI_KEY]'),  # OpenAI key
    (r'\bgh[pousr]_[a-zA-Z0-9]{36}\b', '[GITHUB_TOKEN]'),  # GitHub token
    (r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', '[IP_ADDRESS]'),  # IP
]

# Hermes analysis prompt
ANALYSIS_PROMPT = """You are an expert system optimization agent for Trace, an AI governance platform that records operational evidence of AI agent actions.

Analyze the following user interaction telemetry from Trace. Identify:

1. **Latency Gaps**: Compare input token length vs Time-to-First-Token (TTFT) and total latency. Flag any prompt structures causing anomalous latency spikes (>2σ from median).

2. **Intent-Output Alignment Drift**: Compare user intent classification vs actual LLM output. Flag cases where output doesn't match declared intent (e.g., user requested structured JSON but got conversational text).

3. **Edge Cases & Failure Modes**: Identify unique user behavioral patterns, guardrail bypasses, unhandled exceptions, or policy violations that represent "heavy-tail" scenarios.

4. **Risk Signal Gaps**: Cases where risk_level was misclassified (e.g., high-risk data exposure labeled as low).

Data (last {lookback_minutes} minutes, {sample_count} samples):
{telemetry_json}

Output a strict JSON object with exactly these keys:
{{
  "latency_gaps": [
    {{"pattern": "description", "severity": "high|medium|low", "evidence": "specific metrics", "synthetic_variations": ["var1", "var2", ...]}}
  ],
  "intent_drifts": [
    {{"expected_intent": "intent", "actual_behavior": "description", "severity": "high|medium|low", "synthetic_test_cases": ["test1", "test2"]}}
  ],
  "edge_cases": [
    {{"category": "type", "description": "what happened", "severity": "high|medium|low", "anonymized_payload": "cleaned version", "test_injection_priority": "high|medium|low"}}
  ],
  "risk_gaps": [
    {{"expected_risk": "high|medium|low", "actual_risk": "high|medium|low", "context": "why misclassified", "correction": "what should change"}}
  ],
  "new_test_synthetic_dataset": [
    {{"query": "synthetic query", "intent_classification": "intent", "domain_alignment": "in_domain|adjacent|out_of_domain", "risk_level": "high|medium|low", "risk_signals": ["signal1"], "source": "latency_gap|intent_drift|edge_case|risk_gap"}}
  ],
  "summary": "One paragraph executive summary of findings."
}}"""

# ─── Utility Functions ──────────────────────────────────────────────────────

def clean_pii(text: str) -> str:
    """Remove PII from text using regex patterns."""
    cleaned = text
    for pattern_def in PII_PATTERNS:
        if len(pattern_def) == 3:
            pattern, replacement, flags = pattern_def
            cleaned = re.sub(pattern, replacement, cleaned, flags=flags)
        else:
            pattern, replacement = pattern_def
            cleaned = re.sub(pattern, replacement, cleaned)
    return cleaned


def get_session() -> requests.Session:
    """Create a requests session with retry logic."""
    session = requests.Session()
    retry = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


def fetch_telemetry(session: requests.Session, minutes: int = TELEMETRY_LOOKBACK_MINUTES) -> List[Dict]:
    """Fetch recent telemetry from Trace data plane."""
    try:
        resp = session.get(
            f"{TRACE_TELEMETRY_API}/recent",
            params={"minutes": minutes},
            timeout=10
        )
        if resp.status_code == 200:
            return resp.json()
        else:
            print(f"Telemetry API returned {resp.status_code}: {resp.text}")
            return []
    except requests.exceptions.ConnectionError:
        print(f"Could not connect to Trace telemetry API at {TRACE_TELEMETRY_API}")
        return []
    except Exception as e:
        print(f"Error fetching telemetry: {e}")
        return []


def transform_telemetry(raw_logs: List[Dict]) -> List[Dict]:
    """Transform raw telemetry into analysis format."""
    transformed = []
    for log in raw_logs:
        # Extract relevant fields
        transformed.append({
            "timestamp": log.get("timestamp"),
            "user_id": log.get("user_id", "anonymous"),
            "session_id": log.get("session_id"),
            "query": log.get("input", log.get("query", log.get("prompt", ""))),
            "response_preview": (log.get("output", log.get("response", ""))[:200] + "...") if log.get("output") or log.get("response") else "",
            "latency_ms": log.get("latency_ms", log.get("total_latency_ms", log.get("ttft_ms", 0))),
            "ttft_ms": log.get("ttft_ms", 0),
            "prompt_tokens": log.get("prompt_tokens", len(log.get("input", "").split())),
            "completion_tokens": log.get("completion_tokens", len(log.get("output", "").split())),
            "intent_classification": log.get("intent_classification"),
            "domain_alignment": log.get("domain_alignment"),
            "risk_level": log.get("risk_level"),
            "risk_signals": log.get("risk_signals", []),
            "error": log.get("error"),
            "model": log.get("model", "unknown"),
        })
    return transformed


def build_analysis_prompt(telemetry: List[Dict], minutes: int) -> str:
    """Build the prompt for Hermes analysis."""
    # Clean PII from telemetry before sending
    clean_telemetry = []
    for t in telemetry:
        clean_t = t.copy()
        clean_t["query"] = clean_pii(t["query"])
        clean_t["response_preview"] = clean_pii(t["response_preview"])
        clean_telemetry.append(clean_t)
    
    return ANALYSIS_PROMPT.format(
        lookback_minutes=minutes,
        sample_count=len(clean_telemetry),
        telemetry_json=json.dumps(clean_telemetry, indent=2)
    )


def call_hermes(prompt: str) -> Optional[Dict]:
    """Call the local MLX server for analysis."""
    try:
        payload = {
            "model": MLX_ANALYSIS_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": MAX_TOKENS_ANALYSIS,
            "temperature": TEMPERATURE,
            "top_p": 0.95,
        }
        resp = requests.post(MLX_SERVER_URL, json=payload, timeout=120)
        resp.raise_for_status()
        result = resp.json()
        content = result["choices"][0]["message"]["content"]
        
        # Extract JSON from response
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        else:
            print(f"Could not extract JSON from Hermes response: {content[:200]}")
            return None
    except Exception as e:
        print(f"Error calling Hermes: {e}")
        return None


def save_continuous_learning(analysis: Dict, telemetry: List[Dict]) -> None:
    """Append analysis and telemetry to continuous learning dataset."""
    CONTINUOUS_LEARNING_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    record = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "telemetry_window": {
            "start": (datetime.utcnow() - timedelta(minutes=TELEMETRY_LOOKBACK_MINUTES)).isoformat() + "Z",
            "end": datetime.utcnow().isoformat() + "Z",
            "sample_count": len(telemetry),
        },
        "telemetry_sample": telemetry[:10],  # Store sample (storage management)
        "hermes_analysis": analysis,
        "test_vectors_generated": len(analysis.get("new_test_synthetic_dataset", [])),
    }
    
    with open(CONTINUOUS_LEARNING_PATH, "a") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    
    # Also save synthetic dataset separately for training
    synthetic_path = Path("datasets/synthetic_test_vectors.jsonl")
    synthetic_path.parent.mkdir(parents=True, exist_ok=True)
    for test_vec in analysis.get("new_test_synthetic_dataset", []):
        test_vec["generated_at"] = datetime.utcnow().isoformat() + "Z"
        test_vec["source_analysis_id"] = hashlib.md5(json.dumps(analysis, sort_keys=True).encode()).hexdigest()[:12]
        with open(synthetic_path, "a") as f:
            f.write(json.dumps(test_vec, ensure_ascii=False) + "\n")


def cache_telemetry(telemetry: List[Dict]) -> None:
    """Cache raw telemetry for audit trail."""
    TELEMETRY_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    for t in telemetry:
        t["_cached_at"] = datetime.utcnow().isoformat() + "Z"
        with open(TELEMETRY_CACHE_PATH, "a") as f:
            f.write(json.dumps(t, ensure_ascii=False) + "\n")


def count_synthetic_samples() -> int:
    """Count total synthetic samples generated."""
    path = Path("datasets/synthetic_test_vectors.jsonl")
    if not path.exists():
        return 0
    with open(path) as f:
        return sum(1 for _ in f)


# ─── Main Entry Point ───────────────────────────────────────────────────────

def main():
    print(f"[{datetime.utcnow().isoformat()}] Starting Trace data flywheel evaluation...")
    
    session = get_session()
    
    # 1. Fetch telemetry
    print("  Fetching telemetry...")
    raw_logs = fetch_telemetry(session, TELEMETRY_LOOKBACK_MINUTES)
    
    if not raw_logs:
        print("  No new telemetry data. Exiting.")
        return
    
    print(f"  Fetched {len(raw_logs)} telemetry records")
    
    # 2. Transform
    telemetry = transform_telemetry(raw_logs)
    
    # Filter for samples with meaningful data
    meaningful = [t for t in telemetry if t["query"].strip()]
    if len(meaningful) < MIN_TELEMETRY_SAMPLES:
        print(f"  Only {len(meaningful)} meaningful samples (min {MIN_TELEMETRY_SAMPLES}). Skipping analysis.")
        return
    
    # 3. Cache raw telemetry
    cache_telemetry(raw_logs)
    
    # 4. Build prompt and call Hermes
    print("  Analyzing with Hermes...")
    prompt = build_analysis_prompt(meaningful, TELEMETRY_LOOKBACK_MINUTES)
    analysis = call_hermes(prompt)
    
    if not analysis:
        print("  Hermes analysis failed. Exiting.")
        return
    
    # 5. Save to continuous learning dataset
    print("  Saving to continuous learning dataset...")
    save_continuous_learning(analysis, meaningful)
    
    # 6. Report
    synthetic_count = count_synthetic_samples()
    print(f"\n  Analysis complete!")
    print(f"  Latency gaps found: {len(analysis.get('latency_gaps', []))}")
    print(f"  Intent drifts found: {len(analysis.get('intent_drifts', []))}")
    print(f"  Edge cases found: {len(analysis.get('edge_cases', []))}")
    print(f"  Risk gaps found: {len(analysis.get('risk_gaps', []))}")
    print(f"  New test vectors generated: {len(analysis.get('new_test_synthetic_dataset', []))}")
    print(f"  Total synthetic samples accumulated: {synthetic_count}")
    print(f"  Summary: {analysis.get('summary', 'N/A')}")
    
    # Check if we should trigger retraining
    if synthetic_count >= 100:
        print(f"\n  ⚠️  THRESHOLD REACHED: {synthetic_count} synthetic samples accumulated.")
        print(f"     Trigger MLX LoRA fine-tuning: python train_trigger.py")
    
    print(f"[{datetime.utcnow().isoformat()}] Data flywheel cycle complete.")


if __name__ == "__main__":
    main()