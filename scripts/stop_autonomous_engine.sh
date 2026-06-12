#!/usr/bin/env bash
# Stop Trace Autonomous Testing Engine

set -euo pipefail

PROJECT_DIR="/Users/cnazarko/stria systems/TraceV2"
LOG_DIR="$PROJECT_DIR/logs"
PID_FILE="$LOG_DIR/engine.pids"

echo "Stopping Trace Autonomous Testing Engine..."

# Kill MLX server
if pgrep -f "mlx_lm.server" > /dev/null; then
    pkill -f "mlx_lm.server"
    echo "  ✓ MLX server stopped"
fi

# Kill telemetry API
if pgrep -f "trace_telemetry_mock.py" > /dev/null; then
    pkill -f "trace_telemetry_mock.py"
    echo "  ✓ Telemetry API stopped"
fi

# Kill any remaining python processes from our scripts
if [ -f "$PID_FILE" ]; then
    for pid in $(cat "$PID_FILE"); do
        kill $pid 2>/dev/null || true
    done
    rm -f "$PID_FILE"
fi

echo "All engines stopped."