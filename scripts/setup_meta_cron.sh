#!/bin/bash
# Install the meta-monitoring cron job (runs every 30 minutes)

set -euo pipefail

PROJECT_DIR="/Users/cnazarko/stria systems/TraceV2"
PYTHON="$PROJECT_DIR/.venv-mlx/bin/python"
META_CRON_SCRIPT="$PROJECT_DIR/scripts/meta_cron_orchestrator.py"
RL_TRAINER_SCRIPT="$PROJECT_DIR/scripts/meta_rl_trainer.py"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"

# Make scripts executable
chmod +x "$META_CRON_SCRIPT"
chmod +x "$RL_TRAINER_SCRIPT"

# Build cron entries
CRON_ENTRIES="
# Meta-Monitoring Harness (Self-Evolving)
# Meta-Cron Orchestrator - every 30 minutes at :00 and :30
0,30 * * * * cd \"$PROJECT_DIR\" && \"$PYTHON\" \"$META_CRON_SCRIPT\" >> \"$LOG_DIR/meta_cron.log\" 2>&1

# Meta-RL Policy Trainer - weekly on Sunday at 4 AM
0 4 * * 0 cd \"$PROJECT_DIR\" && \"$PYTHON\" \"$RL_TRAINER_SCRIPT\" --train >> \"$LOG_DIR/meta_rl_train.log\" 2>&1
"

# Install cron (remove existing meta-cron entries first)
(crontab -l 2>/dev/null | grep -v "Meta-Monitoring Harness"; crontab -l 2>/dev/null | grep -v "meta_cron_orchestrator"; crontab -l 2>/dev/null | grep -v "meta_rl_trainer"; echo "$CRON_ENTRIES") | crontab -

echo "✅ Meta-cron installed: runs at :00 and :30 every hour"
echo "✅ Meta-RL trainer installed: runs weekly Sunday 4 AM"
echo ""
crontab -l | grep -A 5 "Meta-Monitoring"