#!/usr/bin/env bash
# start_mlx_server.sh - Start MLX server with Trace adapter

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Configuration
MODEL="${TRACE_MLX_MODEL:-mlx-community/Qwen2.5-1.5B-Instruct-4bit}"
ADAPTER_PATH="${TRACE_MLX_ADAPTER_PATH:-.trace/adapters/trace-enterprise-full-600}"
PORT="${TRACE_MLX_PORT:-8080}"
HOST="${TRACE_MLX_HOST:-127.0.0.1}"

# Kill any existing MLX servers on our ports to prevent sprawl
echo "Cleaning up existing MLX servers on ports 8080, 8085, 9001..."
lsof -ti :8080 :8085 :9001 2>/dev/null | xargs -r kill -9 2>/dev/null || true
sleep 0.5

echo "Starting MLX server..."
echo "  Model: $MODEL"
echo "  Adapter: $ADAPTER_PATH"
echo "  Host: $HOST:$PORT"

# Check if adapter exists
if [[ ! -f "$ADAPTER_PATH/adapters.safetensors" ]]; then
    echo "ERROR: Adapter not found at $ADAPTER_PATH"
    exit 1
fi

# Start server
exec mlx_lm.server \
    --model "$MODEL" \
    --adapter-path "$ADAPTER_PATH" \
    --host "$HOST" \
    --port "$PORT" \
    --log-level INFO