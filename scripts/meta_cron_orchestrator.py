#!/usr/bin/env python3
"""
THE META-CRON: Runs every 30 minutes.
Orchestrates the entire meta-monitoring loop:
1. Scores monitor effectiveness
2. Classifies intent
3. Spawns/adjusts cron jobs
4. Extends harness
5. Logs RL reward
"""

import json
import sys
from datetime import datetime
from pathlib import Path

# Add scripts to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from meta_effectiveness_scorer import MetaEffectivenessScorer
from meta_intent_classifier import MetaIntentClassifier
from cron_templates.generator import generate_cron_script

META_LOG = Path("logs/meta_orchestrator.jsonl")
STATE_FILE = Path(".trace/meta_state.json")


def main():
    print(f"\n{'='*60}")
    print(f"🧬 META-CRON ORCHESTRATOR — {datetime.utcnow().isoformat()}")
    print(f"{'='*60}")

    cycle_start = datetime.utcnow().isoformat()

    # 1. Score current monitor effectiveness
    print("\n📊 Step 1: Scoring monitor effectiveness...")
    scorer = MetaEffectivenessScorer()
    effectiveness = scorer.compute_effectiveness()
    scores = effectiveness["composite_scores"]

    print(f"  Precision:  {scores['precision']:.3f}")
    print(f"  Recall:     {scores['recall']:.3f}")
    print(f"  Coverage:   {scores['coverage']:.3f}")
    print(f"  P50 Trend:  {scores['p50_trend']:.3f}")
    print(f"  Reward:     {scores['composite_reward']:.3f}")

    # 2. Classify intent
    print("\n🧠 Step 2: Classifying system intent...")
    classifier = MetaIntentClassifier()
    state = classifier.gather_state()
    state["cycle_start"] = cycle_start  # Store for reward logging
    decision = classifier.classify(state)

    print(f"  Intent: {decision.primary_intent.value} (confidence: {decision.confidence:.2f})")
    print(f"  Reason: {decision.reasoning}")

    # 3. Generate and spawn cron jobs
    actions_taken = []

    if decision.proposed_cron_jobs:
        print(f"\n⚙️  Step 3: Spawning {len(decision.proposed_cron_jobs)} cron jobs...")
        for job in decision.proposed_cron_jobs:
            # Generate concrete script from template
            # Map job name/reason to template
            template_map = {
                "telemetry": "telemetry_booster",
                "boost": "telemetry_booster",
                "model": "model_evaluator",
                "eval": "model_evaluator",
                "ci": "ci_health_check",
                "fix": "ci_health_check",
                "data": "data_hydration",
                "hydration": "data_hydration",
                "perf": "perf_investigation",
                "latency": "perf_investigation",
                "performance": "perf_investigation",
                "security": "security_hardening",
                "hardening": "security_hardening",
            }

            # Determine template from job name/reason
            job_text = (job.name + " " + job.reason).lower()
            template_name = "telemetry_booster"  # default
            for keyword, tname in template_map.items():
                if keyword in job_text:
                    template_name = tname
                    break

            template_spec = {
                "name": job.name,
                "template": template_name,
                **{k: v for k, v in job.__dict__.items() if k not in ["name", "script", "args", "schedule", "priority", "reason"]},
            }
            script_path = generate_cron_script(template_spec)

            # Update job with generated script
            job.script = str(script_path)

            # Normalize schedule to standard 5-field cron (hermes doesn't support quartz format)
            # Quartz: cron(0-59/10 * * * ? *) -> Standard: */10 * * * *
            schedule = job.schedule
            if schedule.startswith("cron(") and schedule.endswith(")"):
                # Extract quartz expression
                quartz = schedule[5:-1]
                # Simple conversion: */10 * * * * for every 10 minutes
                if "0-59/10" in quartz:
                    schedule = "*/10 * * * *"
                elif "0 * * * * ?" in quartz:
                    schedule = "0 * * * *"
                else:
                    schedule = "0 * * * *"  # Default fallback
            job.schedule = schedule

            # Spawn via HERMES cron
            if classifier._spawn_cron_job(job):
                actions_taken.append(f"spawned:{job.name}")

    # 4. Create harness extensions
    if decision.harness_extensions:
        print(f"\n🔧 Step 4: Creating {len(decision.harness_extensions)} harness extensions...")
        for ext in decision.harness_extensions:
            if classifier._create_harness_extension(ext):
                actions_taken.append(f"harness:{ext.file}")

    # Also log the decision for RL training
    classifier._log_decision(decision, actions_taken)

    # 5. Log meta-reward for RL
    print("\n🎯 Step 5: Logging meta-reward...")
    reward = scorer.log_meta_reward(cycle_start, datetime.utcnow().isoformat(), actions_taken)
    print(f"  Meta-reward: {reward:.3f}")

    # 6. Persist state
    print("\n💾 Step 6: Persisting meta-state...")
    meta_state = {
        "last_run": datetime.utcnow().isoformat(),
        "effectiveness_scores": scores,
        "last_decision": {
            "intent": decision.primary_intent.value,
            "confidence": decision.confidence,
            "reasoning": decision.reasoning,
        },
        "actions_taken": actions_taken,
        "meta_reward": reward,
        "cron_jobs_active": len(decision.proposed_cron_jobs),
        "harness_extensions_pending": len(decision.harness_extensions),
    }
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(meta_state, indent=2))

    # 7. Log full cycle
    META_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(META_LOG, "a") as f:
        f.write(json.dumps(meta_state) + "\n")

    print(f"\n✅ META-CRON COMPLETE")
    print(f"   Actions: {actions_taken}")
    print(f"   Next run: +30 minutes")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()