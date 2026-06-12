#!/usr/bin/env bash
# setup_cron.sh - Install cron jobs for Trace data flywheel

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Setting up Trace data flywheel cron jobs..."
echo "Root: $ROOT_DIR"

# Create cron entries
CRON_ENTRIES="
# Trace Data Flywheel - runs every hour
0 * * * * cd $ROOT_DIR && .venv-mlx/bin/python scripts/evaluate_trace.py >> $ROOT_DIR/logs/evaluate_trace.log 2>&1

# Trace Retrain Monitor - runs every 5 minutes
*/5 * * * * cd $ROOT_DIR && .venv-mlx/bin/python scripts/retrain_monitor.py --once >> $ROOT_DIR/logs/retrain_monitor.log 2>&1

# Stria Systems Deployment Monitor - runs every 15 minutes
*/15 * * * * cd $ROOT_DIR && .venv-mlx/bin/python scripts/monitor_deployment.py >> $ROOT_DIR/logs/deployment_monitor.log 2>&1
"

# Add --once flag support to retrain_monitor.py
# For now, install the evaluate_trace cron
mkdir -p "$ROOT_DIR/logs"

# Check if cron entry already exists
if crontab -l 2>/dev/null | grep -q "evaluate_trace.py"; then
    echo "Cron entry for evaluate_trace.py already exists"
else
    (crontab -l 2>/dev/null; echo "$CRON_ENTRIES") | crontab -
    echo "Cron jobs installed"
fi

echo ""

echo "Installed cron jobs:"
crontab -l | grep -E "evaluate_trace|retrain_monitor|monitor_deployment"

echo ""
echo "Log files:"
echo "  $ROOT_DIR/logs/evaluate_trace.log"
echo "  $ROOT_DIR/logs/retrain_monitor.log"
echo "  $ROOT_DIR/logs/deployment_monitor.log"