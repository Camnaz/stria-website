#!/usr/bin/env bash
# Install cron jobs for Trace Autonomous Testing Engine

set -euo pipefail

PROJECT_DIR="/Users/cnazarko/stria systems/TraceV2"
PYTHON="$PROJECT_DIR/.venv-mlx/bin/python"
EVAL_SCRIPT="$PROJECT_DIR/scripts/evaluate_trace.py"
MLX_SERVER_SCRIPT="$PROJECT_DIR/scripts/start_mlx_server.sh"
LOG_DIR="$PROJECT_DIR/logs"
CRON_LOG="$LOG_DIR/cron.log"

mkdir -p "$LOG_DIR"

# Make scripts executable
chmod +x "$MLX_SERVER_SCRIPT"
chmod +x "$EVAL_SCRIPT"

# Build cron entries
CRON_ENTRIES="
# Trace Autonomous Testing Engine
# MLX Server - ensure running (restart on failure)
* * * * * if ! pgrep -f 'mlx_lm.server' > /dev/null; then cd $PROJECT_DIR && $MLX_SERVER_SCRIPT >> $LOG_DIR/mlx_server.log 2>&1 & fi

# Evaluation Flywheel - every hour at minute 5
5 * * * * cd $PROJECT_DIR && $PYTHON $EVAL_SCRIPT >> $LOG_DIR/eval_flywheel.log 2>&1

# Daily metrics rollup - 2 AM
0 2 * * * cd $PROJECT_DIR && $PYTHON -c "
import json
from pathlib import Path
from datetime import datetime, timedelta
metrics_log = Path('metrics_log.jsonl')
if metrics_log.exists():
    from collections import defaultdict
    daily = defaultdict(list)
    for line in metrics_log.open():
        try:
            m = json.loads(line)
            day = m['timestamp'][:10]
            daily[day].append(m)
        except:
            pass
    for day, metrics in daily.items():
        avg_p95 = sum(m['latency_p95'] for m in metrics) / len(metrics)
        total_events = sum(m['event_count'] for m in metrics)
        avg_error = sum(m['error_rate'] for m in metrics) / len(metrics)
        print(f'{day}: events={total_events}, p95={avg_p95:.0f}ms, error_rate={avg_error:.2%}')
" >> $LOG_DIR/daily_rollup.log 2>&1

# Weekly retrain check - Sunday 3 AM
0 3 * * 0 cd $PROJECT_DIR && $PYTHON -c "
from scripts.evaluate_trace import check_retrain_trigger
if check_retrain_trigger():
    from scripts.evaluate_trace import trigger_retrain
    trigger_retrain()
" >> $LOG_DIR/weekly_retrain.log 2>&1
"

# Install cron
(crontab -l 2>/dev/null | grep -v "Trace Autonomous Testing Engine"; echo "$CRON_ENTRIES") | crontab -

echo "Cron jobs installed:"
crontab -l | grep -A 20 "Trace Autonomous Testing Engine"