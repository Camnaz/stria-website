#!/usr/bin/env python3
"""
Meta-Monitor Layer: Classifies system state into intents that spawn cron jobs.
Uses Hermes (local MLX) to reason about what monitoring the system needs.
"""

import json
import os
import re
import requests
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum

MLX_SERVER_URL = "http://localhost:9001/v1/chat/completions"
META_STATE_PATH = Path(".trace/meta_state.json")
CRON_TEMPLATES_PATH = Path("scripts/cron_templates")

class MetaIntent(Enum):
    NEED_MORE_TELEMETRY = "need_more_telemetry"
    NEED_MODEL_UPGRADE = "need_model_upgrade"
    NEED_HARNESS_EXTENSION = "need_harness_extension"
    NEED_CI_FIX = "need_ci_fix"
    NEED_PERF_INVESTIGATION = "need_perf_investigation"
    NEED_DATA_HYDRATION = "need_data_hydration"
    NEED_SECURITY_HARDENING = "need_security_hardening"
    STABLE = "stable"

INTENT_PROMPT = """You are the Meta-Monitor for Trace, an AI governance platform.
Analyze the current system state and classify what the monitoring system NEEDS right now.

CURRENT STATE:
- Monitor Effectiveness: {effectiveness}
- Production Metrics: {production}
- Retrain History: {retrains}
- CI/CD Health: {ci_health}
- Telemetry Volume: {telemetry_volume} samples/hr
- Synthetic Dataset Size: {synthetic_count} vectors
- Active Adapter: {active_adapter}
- MLX Server Health: {mlx_health}
- Error Patterns: {error_patterns}

AVAILABLE INTENTS:
1. NEED_MORE_TELEMETRY - Low telemetry volume, monitor starved
2. NEED_MODEL_UPGRADE - High-risk recall < 70%, base model too small
3. NEED_HARNESS_EXTENSION - New failure category not covered by evaluate_trace.py
4. NEED_CI_FIX - CI failing, blocking deployments
5. NEED_PERF_INVESTIGATION - Latency regressions detected
6. NEED_DATA_HYDRATION - Remote corpus hydration failing, training data stale
7. NEED_SECURITY_HARDENING - Edge cases show guardrail bypasses
8. STABLE - System healthy, no action needed

Output STRICT JSON with exactly these keys:
{{
  "primary_intent": "INTENT_NAME",
  "confidence": 0.0-1.0,
  "reasoning": "One sentence why",
  "secondary_intents": ["INTENT1", "INTENT2"],
  "proposed_cron_jobs": [
    {{
      "name": "descriptive-name",
      "schedule": "cron expression",
      "script": "path/to/script.py",
      "args": ["--arg1", "value1"],
      "priority": "high|medium|low",
      "reason": "why this cron job"
    }}
  ],
  "harness_extensions": [
    {{
      "file": "path/to/new_check.py",
      "description": "What new check to add to evaluate_trace.py",
      "category": "latency_gap|intent_drift|edge_case|risk_gap|NEW_CATEGORY"
    }}
  ]
}}"""

@dataclass
class CronJobSpec:
    name: str
    schedule: str
    script: str
    args: List[str]
    priority: str
    reason: str

@dataclass
class HarnessExtension:
    file: str
    description: str
    category: str

@dataclass
class MetaDecision:
    primary_intent: MetaIntent
    confidence: float
    reasoning: str
    secondary_intents: List[MetaIntent]
    proposed_cron_jobs: List[CronJobSpec]
    harness_extensions: List[HarnessExtension]

class MetaIntentClassifier:
    def __init__(self, mlx_url: str = MLX_SERVER_URL):
        self.mlx_url = mlx_url
        self.state_path = META_STATE_PATH
    
    def gather_state(self) -> Dict:
        """Collect current system state for classification."""
        state = {}
        
        # 1. Effectiveness from meta DB
        try:
            from meta_effectiveness_scorer import MetaEffectivenessScorer
            scorer = MetaEffectivenessScorer()
            eff = scorer.compute_effectiveness()
            state["effectiveness"] = eff["composite_scores"]
        except Exception as e:
            state["effectiveness"] = {"error": str(e)}
        
        # 2. Production metrics (from MLX server health)
        try:
            resp = requests.get("http://localhost:9001/health", timeout=5)
            state["mlx_health"] = resp.json() if resp.status_code == 200 else {"status": "down"}
        except:
            state["mlx_health"] = {"status": "unreachable"}
        
        # 3. Synthetic dataset size
        synth_path = Path("datasets/synthetic_test_vectors.jsonl")
        state["synthetic_count"] = sum(1 for _ in open(synth_path)) if synth_path.exists() else 0
        
        # 4. Telemetry volume (last hour)
        try:
            resp = requests.get("http://localhost:8084/api/v1/telemetry/stats", timeout=5)
            stats = resp.json()
            state["telemetry_volume"] = stats.get("recent_minute_count", 0) * 60
        except:
            state["telemetry_volume"] = 0
        
        # 5. CI health
        try:
            result = subprocess.run(["gh", "run", "list", "--limit", "5", "--repo", "Camnaz/StriaSystems"],
                                  capture_output=True, text=True, timeout=10)
            lines = result.stdout.strip().split("\n")
            failures = sum(1 for l in lines if l.startswith("completed\tfailure"))
            state["ci_health"] = {"recent_failures": failures, "total": len(lines)}
        except:
            state["ci_health"] = {"error": "gh CLI unavailable"}
        
        # 6. Active adapter
        try:
            result = subprocess.run(["python", "hot_swap.py", "status"], capture_output=True, text=True)
            state["active_adapter"] = result.stdout.strip()
        except:
            state["active_adapter"] = "unknown"
        
        # 7. Error patterns from recent evaluate_trace runs
        eval_log = Path(".hermes/cron/output/4ee5be2e9daa/latest.md")
        state["error_patterns"] = eval_log.read_text()[-2000:] if eval_log.exists() else "none"
        
        # 8. Retrain history
        try:
            from meta_effectiveness_scorer import MetaEffectivenessScorer
            scorer = MetaEffectivenessScorer()
            eff = scorer.compute_effectiveness()
            state["retrains"] = eff["retrain_history"][-3:]
        except:
            state["retrains"] = []
        
        # 9. Production metrics
        try:
            from meta_effectiveness_scorer import MetaEffectivenessScorer
            scorer = MetaEffectivenessScorer()
            eff = scorer.compute_effectiveness()
            state["production"] = eff["production_impact"][:3]
        except:
            state["production"] = []
        
        return state
    
    def classify(self, state: Dict) -> MetaDecision:
        """Call Hermes to classify intent and propose actions."""
        prompt = INTENT_PROMPT.format(
            effectiveness=json.dumps(state.get("effectiveness", {}), indent=2),
            production=json.dumps(state.get("production", []), indent=2),
            retrains=json.dumps(state.get("retrains", []), indent=2),
            ci_health=json.dumps(state.get("ci_health", {}), indent=2),
            telemetry_volume=state.get("telemetry_volume", 0),
            synthetic_count=state.get("synthetic_count", 0),
            active_adapter=state.get("active_adapter", "unknown"),
            mlx_health=json.dumps(state.get("mlx_health", {}), indent=2),
            error_patterns=state.get("error_patterns", "none")[:1000],
        )

        try:
            payload = {
                "model": "local-hermes-base",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 4096,
                "temperature": 0.1,
            }
            resp = requests.post(self.mlx_url, json=payload, timeout=120)
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]

            # Debug: print raw response for debugging
            print(f"[DEBUG] Raw MLX response: {content[:500]}...")

            # Extract JSON
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if not json_match:
                raise ValueError("No JSON in response")

            result = json.loads(json_match.group())

            # Normalize intent to lowercase to match enum
            primary_intent = result.get("primary_intent", "stable").lower().strip()

            # Provide defaults for missing fields in cron jobs
            cron_jobs = []
            for j in result.get("proposed_cron_jobs", []):
                j.setdefault("args", [])
                cron_jobs.append(CronJobSpec(**j))

            harness_extensions = []
            for j in result.get("harness_extensions", []):
                harness_extensions.append(HarnessExtension(**j))

            return MetaDecision(
                primary_intent=MetaIntent(primary_intent),
                confidence=result.get("confidence", 0.5),
                reasoning=result.get("reasoning", "No reasoning provided"),
                secondary_intents=[MetaIntent(i.lower().strip()) for i in result.get("secondary_intents", [])],
                proposed_cron_jobs=cron_jobs,
                harness_extensions=harness_extensions,
            )
        except Exception as e:
            # Debug
            print(f"[DEBUG] Classification failed: {e}")
            return MetaDecision(
                primary_intent=MetaIntent.STABLE,
                confidence=0.5,
                reasoning=f"Classification failed: {e}",
                secondary_intents=[],
                proposed_cron_jobs=[],
                harness_extensions=[],
            )
    
    def execute_decision(self, decision: MetaDecision) -> List[str]:
        """Execute the proposed actions: spawn cron jobs, create harness extensions."""
        actions_taken = []
        
        for job in decision.proposed_cron_jobs:
            if self._spawn_cron_job(job):
                actions_taken.append(f"spawned_cron:{job.name}")
        
        for ext in decision.harness_extensions:
            if self._create_harness_extension(ext):
                actions_taken.append(f"created_harness:{ext.file}")
        
        self._log_decision(decision, actions_taken)
        
        return actions_taken
    
    def _spawn_cron_job(self, job: CronJobSpec) -> bool:
        """Create a HERMES cron job via CLI. Deduplicates by checking existing jobs."""
        # Deduplication: check if a cron job with same name already exists
        import subprocess
        hermes_bin = "/Users/cnazarko/.local/bin/hermes"
        try:
            result = subprocess.run([hermes_bin, "cron", "list"], capture_output=True, text=True, timeout=10)
            if job.name in result.stdout:
                print(f"Cron job '{job.name}' already exists, skipping creation")
                return True
        except Exception as e:
            print(f"Warning: could not check existing cron jobs: {e}")
        
        script_path = Path(job.script)
        if not script_path.exists():
            print(f"Script not found: {job.script}")
            return False

        # Hermes requires scripts to be in ~/.hermes/scripts/
        hermes_scripts_dir = Path.home() / ".hermes" / "scripts"
        hermes_scripts_dir.mkdir(parents=True, exist_ok=True)

        # Copy script to hermes scripts dir
        hermes_script_path = hermes_scripts_dir / script_path.name
        import shutil
        shutil.copy2(script_path, hermes_script_path)
        hermes_script_path.chmod(0o755)

        # Use full path to hermes binary
        hermes_bin = "/Users/cnazarko/.local/bin/hermes"

        cmd = [
            hermes_bin, "cron", "create", job.schedule,
            f"Run {job.script} with args: {' '.join(job.args)}",
            "--name", job.name,
            "--script", script_path.name,  # Just filename, relative to ~/.hermes/scripts/
            "--no-agent",
            "--deliver", "local",
        ]

        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=30)
            print(f"Created cron job: {job.name} ({job.schedule})")
            return True
        except subprocess.CalledProcessError as e:
            print(f"Failed to create cron job {job.name}: {e.stderr.decode()}")
            return False
    
    def _create_harness_extension(self, ext: HarnessExtension) -> bool:
        """Generate a new check module for evaluate_trace.py."""
        proposals_dir = Path("scripts/harness_proposals")
        proposals_dir.mkdir(parents=True, exist_ok=True)
        
        proposal_file = proposals_dir / f"{ext.category}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        proposal_file.write_text(json.dumps(asdict(ext), indent=2))
        print(f"Saved harness extension proposal: {proposal_file}")
        return True
    
    def _log_decision(self, decision: MetaDecision, actions: List[str]):
        """Log meta-decision for RL training."""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "decision": {
                "primary_intent": decision.primary_intent.value,
                "confidence": decision.confidence,
                "reasoning": decision.reasoning,
                "secondary_intents": [i.value for i in decision.secondary_intents],
            },
            "actions_taken": actions,
        }
        
        log_file = Path("logs/meta_decisions.jsonl")
        log_file.parent.mkdir(parents=True, exist_ok=True)
        with open(log_file, "a") as f:
            f.write(json.dumps(log_entry) + "\n")


# Standalone test
if __name__ == "__main__":
    classifier = MetaIntentClassifier()
    
    print("Gathering system state...")
    state = classifier.gather_state()
    
    print("Classifying intent via Hermes...")
    decision = classifier.classify(state)
    
    print(f"""
META DECISION
Primary Intent: {decision.primary_intent.value}
Confidence: {decision.confidence:.2f}
Reasoning: {decision.reasoning}
Proposed Cron Jobs: {len(decision.proposed_cron_jobs)}
Harness Extensions: {len(decision.harness_extensions)}
""")
    
    for job in decision.proposed_cron_jobs:
        print(f"  {job.name} ({job.schedule}) -> {job.script} [{job.priority}]")
        print(f"    Reason: {job.reason}")
    
    for ext in decision.harness_extensions:
        print(f"  {ext.file} [{ext.category}]: {ext.description}")