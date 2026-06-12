#!/usr/bin/env bash
# Start all Trace Autonomous Testing Engine components

set -euo pipefail

PROJECT_DIR="/Users/cnazarko/stria systems/TraceV2"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"

# Kill any existing MLX servers and telemetry APIs on our ports to prevent sprawl
echo "Cleaning up existing processes on ports 8080, 8085, 9001, 8084..."
lsof -ti :8080 :8085 :9001 :8084 2>/dev/null | xargs -r kill -9 2>/dev/null || true
sleep 0.5

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Trace Autonomous Testing Engine - Startup                ║"
echo "╚═══════════════════════════════════════════════════════════╝"

# 1. Start Trace Telemetry API (mock) - FastAPI based on port 8084
echo ""
echo "▶ Starting Trace Telemetry API (port 8084)..."
cd "$PROJECT_DIR"
nohup .venv-mlx/bin/python trace_telemetry_mock.py > "$LOG_DIR/telemetry_api.log" 2>&1 &
TELEMETRY_PID=$!
sleep 3
if curl -s http://localhost:8084/health > /dev/null; then
    echo "  ✓ Telemetry API running (PID: $TELEMETRY_PID)"
else
    echo "  ✗ Telemetry API failed to start"
    exit 1
fi

# 2. Start MLX Server with Trace adapter
echo ""
echo "▶ Starting MLX Server with Trace adapter (port 8080)..."
nohup .venv-mlx/bin/python -m mlx_lm.server \
    --model mlx-community/Qwen2.5-1.5B-Instruct-4bit \
    --adapter-path .trace/adapters/trace-enterprise-full-600 \
    --port 8080 \
    --host 0.0.0.0 > "$LOG_DIR/mlx_server.log" 2>&1 &
MLX_PID=$!
sleep 5
if curl -s http://localhost:8080/v1/models > /dev/null; then
    echo "  ✓ MLX Server running (PID: $MLX_PID)"
else
    echo "  ✗ MLX Server failed to start"
    kill $TELEMETRY_PID 2>/dev/null
    exit 1
fi

# 3. Run initial evaluation cycle
echo ""
echo "▶ Running initial evaluation cycle..."
.venv-mlx/bin/python scripts/evaluate_trace.py

# 4. Install cron jobs
echo ""
echo "▶ Installing cron jobs..."
bash scripts/install_cron.sh

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Trace Autonomous Testing Engine - RUNNING                ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Telemetry API:  http://localhost:8084                   ║"
echo "║  MLX Server:     http://localhost:8080                   ║"
echo "║  Logs:           $LOG_DIR                                ║"
echo "║                                                          ║"
echo "║  Cron Jobs:                                               ║"
echo "║  - MLX health check: every minute                        ║"
echo "║  - Evaluation flywheel: hour:05                          ║"
echo "║  - Daily rollup: 02:00                                   ║"
echo "║  - Weekly retrain check: Sunday 03:00                    ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "To stop: kill $TELEMETRY_PID $MLX_PID"
echo "PIDs saved to $LOG_DIR/engine.pids"

echo "$TELEMETRY_PID $MLX_PID" > "$LOG_DIR/engine.pids"

# Keep script running to show logs
echo ""
echo "Tailing logs (Ctrl+C to stop engines)..."
tail -f "$LOG_DIR/mlx_server.log" "$LOG_DIR/telemetry_api.log" "$LOG_DIR/eval_flywheel.log"