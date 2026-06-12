#!/usr/bin/env python3
"""
Real-time observability dashboard for the Meta-Monitoring Harness.
Tails logs and provides live view of meta-cron activity, effectiveness scores,
intent classifications, and spawned actions.
"""

import json
import os
import sys
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
import threading
import queue


LOG_DIR = Path("/Users/cnazarko/stria systems/TraceV2/logs")
META_CRON_LOG = LOG_DIR / "meta_cron.log"
META_ORCHESTRATOR_LOG = LOG_DIR / "meta_orchestrator.jsonl"
META_DECISIONS_LOG = LOG_DIR / "meta_decisions.jsonl"
EVAL_FLYWHEEL_LOG = LOG_DIR / "eval_flywheel.log"
MLX_SERVER_LOG = LOG_DIR / "mlx_server.log"
DAILY_ROLLUP_LOG = LOG_DIR / "daily_rollup.log"
WEEKLY_RETRAIN_LOG = LOG_DIR / "weekly_retrain.log"


class MetaHarnessDashboard:
    def __init__(self):
        self.running = False
        self.log_queues: Dict[str, queue.Queue] = {}
        self.last_positions: Dict[str, int] = {}
        self.latest_state = {}

    def _read_new_lines(self, filepath: Path) -> List[str]:
        """Read new lines from a file since last position."""
        if not filepath.exists():
            return []

        try:
            with open(filepath, "r") as f:
                f.seek(self.last_positions.get(str(filepath), 0))
                lines = f.readlines()
                self.last_positions[str(filepath)] = f.tell()
                return [line.rstrip("\n") for line in lines if line.strip()]
        except Exception:
            return []

    def _parse_orchestrator_entry(self, line: str) -> Optional[Dict[str, Any]]:
        """Parse a meta_orchestrator.jsonl entry."""
        try:
            return json.loads(line)
        except:
            return None

    def _parse_decisions_entry(self, line: str) -> Optional[Dict[str, Any]]:
        """Parse a meta_decisions.jsonl entry."""
        try:
            return json.loads(line)
        except:
            return None

    def _get_latest_orchestrator_state(self) -> Optional[Dict[str, Any]]:
        """Get the latest state from meta_orchestrator.jsonl."""
        if not META_ORCHESTRATOR_LOG.exists():
            return None

        try:
            with open(META_ORCHESTRATOR_LOG, "r") as f:
                lines = f.readlines()
                if lines:
                    return json.loads(lines[-1])
        except:
            pass
        return None

    def _get_latest_decisions(self, n: int = 5) -> List[Dict[str, Any]]:
        """Get the last N decisions from meta_decisions.jsonl."""
        if not META_DECISIONS_LOG.exists():
            return []

        try:
            with open(META_DECISIONS_LOG, "r") as f:
                lines = f.readlines()
                decisions = []
                for line in lines[-n:]:
                    try:
                        decisions.append(json.loads(line))
                    except:
                        pass
                return decisions
        except:
            return []

    def render_dashboard(self):
        """Render the dashboard to terminal."""
        os.system("clear" if os.name == "posix" else "cls")

        print("╔" + "═" * 78 + "╗")
        print(f"║  🧬 META-MONITORING HARNESS — LIVE DASHBOARD  ║  {datetime.now().strftime('%H:%M:%S')}")
        print("╠" + "═" * 78 + "╣")

        # Latest orchestrator state
        state = self._get_latest_orchestrator_state()
        if state:
            print("║  📊 LATEST META-CYCLE                                                          ║")
            scores = state.get("effectiveness_scores", {})
            print(f"║  Precision: {scores.get('precision', 0):.3f}  Recall: {scores.get('recall', 0):.3f}  "
                  f"Coverage: {scores.get('coverage', 0):.3f}  P50 Trend: {scores.get('p50_trend', 0):.3f}  "
                  f"Reward: {scores.get('composite_reward', 0):.3f}  ║")
            decision = state.get("last_decision", {})
            print(f"║  Intent: {decision.get('intent', 'N/A'):20s}  Confidence: {decision.get('confidence', 0):.2f}  "
                  f"Actions: {len(state.get('actions_taken', []))}  ║")
            print(f"║  Reasoning: {decision.get('reasoning', 'N/A')[:55]:55s}  ║")
            actions = state.get("actions_taken", [])
            if actions:
                for action in actions[:3]:
                    print(f"║    → {action:<68s} ║")
        else:
            print("║  📊 No meta-cycles completed yet                                                ║")

        print("╠" + "─" * 78 + "╣")

        # Recent decisions
        print("║  🧠 RECENT INTENT CLASSIFICATIONS                                              ║")
        decisions = self._get_latest_decisions(5)
        if decisions:
            for d in reversed(decisions):
                decision_info = d.get("decision", {})
                intent = decision_info.get("primary_intent", "unknown")
                conf = decision_info.get("confidence", 0)
                reason = decision_info.get("reasoning", "")[:50]
                ts = d.get("timestamp", "")[11:19]
                print(f"║  {ts}  {intent:25s}  ({conf:.2f})  {reason:<35s} ║")
        else:
            print("║  No decisions logged yet                                                       ║")

        print("╠" + "─" * 78 + "╣")

        # Live log tail
        print("║  📜 LIVE LOG TAIL (meta_cron.log)                                              ║")
        new_lines = self._read_new_lines(META_CRON_LOG)
        if new_lines:
            for line in new_lines[-8:]:
                # Truncate long lines
                display = line[-74:] if len(line) > 74 else line
                print(f"║  {display:<74s} ║")
        else:
            print("║  (waiting for meta-cron output...)                                              ║")

        print("╠" + "─" * 78 + "╣")

        # System health
        print("║  🏥 SYSTEM HEALTH                                                              ║")

        # Check MLX server
        try:
            import requests
            resp = requests.get("http://localhost:9001/health", timeout=2)
            mlx_status = "✅ Healthy" if resp.status_code == 200 else "❌ Down"
            models = resp.json().get("models", {}) if resp.status_code == 200 else {}
            mlx_details = f"Models: {len(models)}"
        except:
            mlx_status = "❌ Unreachable"
            mlx_details = ""

        print(f"║  MLX Server (9001): {mlx_status:<15s} {mlx_details:<50s} ║")

        # Check telemetry API
        try:
            resp = requests.get("http://localhost:8084/api/v1/telemetry/stats", timeout=2)
            if resp.status_code == 200:
                stats = resp.json()
                telemetry_status = "✅ Active"
                t_details = f"Samples/hr: {stats.get('count', 0)*60}  P95: {stats.get('p95_latency_ms', 0):.0f}ms"
            else:
                telemetry_status = f"⚠️  HTTP {resp.status_code}"
                t_details = ""
        except:
            telemetry_status = "❌ Unreachable"
            t_details = ""

        print(f"║  Telemetry API (8084): {telemetry_status:<15s} {t_details:<50s} ║")

        # Check continuous learning dataset
        cl_path = Path("/Users/cnazarko/stria systems/TraceV2/datasets/continuous_learning.jsonl")
        if cl_path.exists():
            count = sum(1 for _ in open(cl_path))
            threshold = int(os.getenv("RETRAIN_THRESHOLD", "20"))
            cl_status = "✅ Ready" if count >= threshold else f"📊 Building ({count}/{threshold})"
        else:
            cl_status = "📭 Empty"
            count = 0
        print(f"║  Continuous Learning: {cl_status:<20s} Entries: {count:<5d}  ║")

        print("╠" + "─" * 78 + "╣")
        print("║  Press Ctrl+C to exit  |  Meta-cron runs at :00/:30  |  RL trains weekly Sun 4AM  ║")
        print("╚" + "═" * 78 + "╝")

    def run(self, refresh_interval: float = 2.0):
        """Run the dashboard loop."""
        self.running = True
        print("Starting Meta-Harness Dashboard...")
        print("Press Ctrl+C to exit\n")

        try:
            while self.running:
                self.render_dashboard()
                time.sleep(refresh_interval)
        except KeyboardInterrupt:
            print("\n\nDashboard stopped.")


def main():
    dashboard = MetaHarnessDashboard()
    dashboard.run(refresh_interval=2.0)


if __name__ == "__main__":
    main()