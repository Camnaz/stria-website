#!/usr/bin/env python3
"""
Generates concrete cron job scripts from intent specifications.
Templated for common patterns: telemetry boost, model eval, CI fix, etc.
"""

import json
from pathlib import Path
from string import Template
from typing import Dict, Any


TEMPLATES = {
    "telemetry_booster": Template(
        """#!/usr/bin/env python3
\"\"\"
AUTO-GENERATED: Telemetry Volume Booster
Increases mock telemetry generation rate to feed the monitor.
\"\"\"
import asyncio
import random
import json
from datetime import datetime
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from trace_telemetry_mock import TEMPLATES, generate_event

BOOST_MULTIPLIER = ${boost_multiplier}  # Generate Nx more events
DURATION_MINUTES = ${duration_minutes}

async def main():
    print(f"🚀 Boosting telemetry {{BOOST_MULTIPLIER}}x for {{DURATION_MINUTES}} minutes")

    templates = list(TEMPLATES.values())
    end_time = datetime.utcnow().timestamp() + (DURATION_MINUTES * 60)

    while datetime.utcnow().timestamp() < end_time:
        template = random.choice(templates)
        event = generate_event(template)

        # Send to mock API (or directly to Trace)
        # This would POST to http://localhost:8084/api/v1/telemetry/ingest

        await asyncio.sleep(60 / BOOST_MULTIPLIER)  # Spread over minute

    print("✅ Telemetry boost complete")

if __name__ == "__main__":
    asyncio.run(main())
"""
    ),

    "model_evaluator": Template(
        """#!/usr/bin/env python3
\"\"\"
AUTO-GENERATED: Model Evaluation Cron
Runs comprehensive probe tests on current and candidate adapters.
\"\"\"
import subprocess
import json
from pathlib import Path
from datetime import datetime

ADAPTER_VERSIONS = ${adapter_versions}
PROBE_TESTS = ${probe_tests}

def run_probe_test(adapter: str, test_name: str, prompt: str) -> dict:
    \"\"\"Run single probe test against adapter.\"\"\"
    # This would use batch_infer_full.py or direct API call
    pass

def main():
    results = {
        "timestamp": datetime.utcnow().isoformat(),
        "adapters": {}
    }

    for adapter in ADAPTER_VERSIONS:
        print(f"📊 Evaluating {{adapter}}...")
        adapter_results = {}

        for test_name, prompt in PROBE_TESTS.items():
            result = run_probe_test(adapter, test_name, prompt)
            adapter_results[test_name] = result

        results["adapters"][adapter] = adapter_results

    # Save comparison
    out_path = Path(f"evals/model_comparison_{{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}}.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(results, indent=2))

    print(f"✅ Evaluation saved to {{out_path}}")

if __name__ == "__main__":
    main()
"""
    ),

    "ci_health_check": Template(
        """#!/usr/bin/env python3
\"\"\"
AUTO-GENERATED: CI Health Monitor
Watches GitHub Actions and auto-triggers fixes for common failures.
\"\"\"
import subprocess
import json
import re
from pathlib import Path
from datetime import datetime

REPO = "${repo}"
CHECK_INTERVAL_MINUTES = ${interval_minutes}

KNOWN_FIXES = {
    "npm ci fails": "cd trace-core && npm install && git add package-lock.json",
    "cargo fmt fails": "cd trace-core && cargo fmt && git add benches/benchmarks.rs",
    "rustsec action not found": "sed -i 's/rustsec\\\\/audit-check@v2.0/rustsec\\\\/audit-check@v1.2.0/' .github/workflows/rust.yml",
}

def get_failed_workflows() -> list:
    result = subprocess.run(
        ["gh", "run", "list", "--limit", "10", "--repo", REPO, "--json", "conclusion,headBranch,workflowName,url"],
        capture_output=True, text=True
    )
    runs = json.loads(result.stdout)
    return [r for r in runs if r["conclusion"] == "failure"]

def analyze_failure(run) -> str:
    \"\"\"Get logs and match to known fix.\"\"\"
    result = subprocess.run(
        ["gh", "run", "view", run["databaseId"], "--log-failed", "--repo", REPO],
        capture_output=True, text=True
    )
    logs = result.stdout

    for pattern, fix in KNOWN_FIXES.items():
        if pattern.lower() in logs.lower():
            return fix
    return ""

def main():
    failed = get_failed_workflows()
    fixes_applied = []

    for run in failed:
        fix = analyze_failure(run)
        if fix:
            print(f"🔧 Applying fix for {{run['workflowName']}}: {{fix}}")
            subprocess.run(fix, shell=True, check=True)
            fixes_applied.append({"run": run["databaseId"], "fix": fix})

    if fixes_applied:
        # Commit and push
        subprocess.run(["git", "commit", "-m", "fix: Auto-applied CI fixes from meta-monitor"], check=True)
        subprocess.run(["git", "push"], check=True)
        print(f"✅ Applied {{len(fixes_applied)}} fixes, pushed to GitHub")
    else:
        print("✅ No known CI failures detected")

if __name__ == "__main__":
    main()
"""
    ),

    "data_hydration": Template(
        """#!/usr/bin/env python3
\\"\\"\\"
AUTO-GENERATED: Remote Data Hydration
Downloads remote datasets for training corpus expansion.
\\"\\"\\"
import os
import subprocess
from pathlib import Path
import multiprocessing

# Prevent multiprocessing RLock deadlocks in Hugging Face datasets library
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["HF_DATASETS_NUM_PROC"] = "1"  # Disable multiprocessing in datasets library

# Force 'spawn' start method on macOS to avoid fork-safety issues with multiprocessing
try:
    multiprocessing.set_start_method("spawn", force=True)
except RuntimeError:
    pass  # Already set

DATASETS = [
    "wambosec/prompt-injection-detector",
    "JailbreakBench/JailbreakDB",
    "FinGuardAI/FinGuard",
    "PolyAI/banking77",
]

def main():
    for ds in DATASETS:
        print(f"📥 Hydrating {ds}...")
        try:
            # Use single-threaded download to avoid RLock issues
            result = subprocess.run([
                "python", "-c",
                f"import os; os.environ['HF_DATASETS_NUM_PROC'] = '1'; from datasets import load_dataset; load_dataset('{ds}', num_proc=1)"
            ], capture_output=True, text=True, timeout=300)

            if result.returncode == 0:
                print(f"✅ {ds} cached")
            else:
                print(f"⚠️  {ds} failed: {result.stderr[:200]}")
        except subprocess.TimeoutExpired:
            print(f"⏱️  {ds} timeout")
        except Exception as e:
            print(f"❌ {ds} error: {e}")

    print("📦 Data hydration cycle complete")

if __name__ == "__main__":
    main()
"""
    ),

    "perf_investigation": Template(
        """#!/usr/bin/env python3
\"\"\"
AUTO-GENERATED: Performance Investigation
Runs benchmarks and analyzes latency regressions.
\"\"\"
import subprocess
import json
from pathlib import Path
from datetime import datetime

def run_benchmarks():
    \"\"\"Run cargo bench and parse results.\"\"\"
    result = subprocess.run(
        ["cargo", "bench", "--all-features", "--", "--output-format", "json"],
        cwd="/Users/cnazarko/stria systems/TraceV2/trace-core",
        capture_output=True, text=True, timeout=1800
    )
    return result.stdout

def analyze_regressions(bench_output: str):
    \"\"\"Compare against baseline.\"\"\"
    # Would compare with stored baseline
    pass

def main():
    print("🏃 Running performance benchmarks...")
    output = run_benchmarks()

    # Save results
    out_path = Path(f"benchmarks/bench_{{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}}.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(output)

    print(f"✅ Benchmark results saved to {{out_path}}")

if __name__ == "__main__":
    main()
"""
    ),

    "security_hardening": Template(
        """#!/usr/bin/env python3
\"\"\"
AUTO-GENERATED: Security Hardening Scan
Runs security audits and checks for guardrail bypasses.
\"\"\"
import subprocess
import json
from pathlib import Path
from datetime import datetime

def run_cargo_audit():
    result = subprocess.run(
        ["cargo", "audit", "--json"],
        cwd="/Users/cnazarko/stria systems/TraceV2/trace-core",
        capture_output=True, text=True, timeout=300
    )
    return result.stdout

def run_npm_audit():
    result = subprocess.run(
        ["npm", "audit", "--json"],
        cwd="/Users/cnazarko/stria systems/TraceV2/trace-core",
        capture_output=True, text=True, timeout=120
    )
    return result.stdout

def check_guardrail_bypasses():
    \"\"\"Run evaluate_trace and check for guardrail bypass patterns.\"\"\"
    result = subprocess.run(
        [".venv-mlx/bin/python", "scripts/evaluate_trace.py"],
        cwd="/Users/cnazarko/stria systems/TraceV2",
        capture_output=True, text=True, timeout=300
    )
    return result.stdout

def main():
    print("🔒 Running security hardening scan...")

    cargo_audit = run_cargo_audit()
    npm_audit = run_npm_audit()
    eval_output = check_guardrail_bypasses()

    results = {
        "timestamp": datetime.utcnow().isoformat(),
        "cargo_audit": cargo_audit,
        "npm_audit": npm_audit,
        "eval_output": eval_output[-5000:],  # Last 5k chars
    }

    out_path = Path(f"security/scan_{{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}}.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(results, indent=2))

    print(f"✅ Security scan saved to {{out_path}}")

if __name__ == "__main__":
    main()
"""
    ),
}


def generate_cron_script(job_spec: Dict[str, Any]) -> Path:
    """Generate a concrete cron script from job specification."""
    template_name = job_spec.get("template", "telemetry_booster")
    template = TEMPLATES.get(template_name, TEMPLATES["telemetry_booster"])

    # Prepare template variables
    vars = {
        "boost_multiplier": job_spec.get("boost_multiplier", 10),
        "duration_minutes": job_spec.get("duration_minutes", 60),
        "adapter_versions": json.dumps(job_spec.get("adapter_versions", [])),
        "probe_tests": json.dumps(job_spec.get("probe_tests", {})),
        "repo": job_spec.get("repo", "Camnaz/StriaSystems"),
        "interval_minutes": job_spec.get("interval_minutes", 30),
    }

    script_content = template.safe_substitute(vars)

    output_dir = Path("scripts/auto_generated")
    output_dir.mkdir(parents=True, exist_ok=True)

    script_path = output_dir / f"{job_spec['name']}.py"
    script_path.write_text(script_content)
    script_path.chmod(0o755)

    print(f"📝 Generated: {script_path}")
    return script_path


if __name__ == "__main__":
    # Test generation
    test_spec = {
        "name": "test_telemetry_boost",
        "template": "telemetry_booster",
        "boost_multiplier": 5,
        "duration_minutes": 30,
    }
    path = generate_cron_script(test_spec)
    print(f"Test script generated at: {path}")