#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Prevent multiprocessing RLock deadlocks in Hugging Face datasets library
export TOKENIZERS_PARALLELISM=false
export HF_HUB_DISABLE_SYMLINKS_WARNING=1
export HF_HUB_DISABLE_PROGRESS_BARS=1
export HF_DATASETS_NUM_PROC=1

MODEL="${TRACE_MLX_MODEL:-mlx-community/Qwen2.5-1.5B-Instruct-4bit}"
# Use venv python if available, otherwise system python3
if [[ -f "$ROOT_DIR/.venv-mlx/bin/python3" ]]; then
    PYTHON="$ROOT_DIR/.venv-mlx/bin/python3"
elif [[ -f "$ROOT_DIR/.venv-mlx/bin/python" ]]; then
    PYTHON="$ROOT_DIR/.venv-mlx/bin/python"
else
    PYTHON="${TRACE_PYTHON:-python3}"
fi
OUTPUT_DIR="${TRACE_MLX_OUTPUT_DIR:-datasets/trace-enterprise}"
ADAPTER_PATH="${TRACE_MLX_ADAPTER_PATH:-.trace/adapters/trace-enterprise}"
ITERS="${TRACE_MLX_ITERS:-600}"
BATCH_SIZE="${TRACE_MLX_BATCH_SIZE:-1}"
NUM_LAYERS="${TRACE_MLX_NUM_LAYERS:-4}"
BUILD_MODE="--local-only"
LIMIT_OPT=""
LIMIT_VALUE=""
DRY_RUN="${TRACE_MLX_DRY_RUN:-0}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-remote)
      BUILD_MODE="--with-remote"
      ;;
    --local-only)
      BUILD_MODE="--local-only"
      ;;
    --limit)
      shift
      LIMIT_OPT="--limit"
      LIMIT_VALUE="$1"
      ;;
    --model)
      shift
      MODEL="$1"
      ;;
    --adapter-path)
      shift
      ADAPTER_PATH="$1"
      ;;
    --iters)
      shift
      ITERS="$1"
      ;;
    --batch-size)
      shift
      BATCH_SIZE="$1"
      ;;
    --num-layers)
      shift
      NUM_LAYERS="$1"
      ;;
    --output-dir)
      shift
      OUTPUT_DIR="$1"
      ;;
    --dry-run|--build-only)
      DRY_RUN="1"
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
  shift
done

mkdir -p "$(dirname "$ADAPTER_PATH")"

echo "Building Trace MLX corpus..."
if [[ -n "$LIMIT_OPT" ]]; then
  "$PYTHON" prototype/mlx-classifier/build_enterprise_corpus.py "$BUILD_MODE" "$LIMIT_OPT" "$LIMIT_VALUE" --output-dir "$OUTPUT_DIR"
else
  "$PYTHON" prototype/mlx-classifier/build_enterprise_corpus.py "$BUILD_MODE" --output-dir "$OUTPUT_DIR"
fi

echo "Scoring deterministic baseline on held-out split..."
"$PYTHON" prototype/mlx-classifier/baseline_predict_usage.py \
  --input "$OUTPUT_DIR/test.jsonl" \
  --output "$OUTPUT_DIR/baseline-predictions.jsonl"
"$PYTHON" prototype/mlx-classifier/evaluate_usage_labels.py \
  --labels "$OUTPUT_DIR/test.jsonl" \
  --predictions "$OUTPUT_DIR/baseline-predictions.jsonl" \
  --output "$OUTPUT_DIR/baseline-report.json" \
  --min-high-risk-recall 0.8

if [[ "$DRY_RUN" == "1" ]]; then
  echo "Dry run complete. MLX training command:"
  printf '%q -m mlx_lm lora --model %q --train --data %q --mask-prompt --adapter-path %q --iters %q --batch-size %q --num-layers %q --grad-checkpoint\n' \
    "$PYTHON" "$MODEL" "$OUTPUT_DIR" "$ADAPTER_PATH" "$ITERS" "$BATCH_SIZE" "$NUM_LAYERS"
  exit 0
fi

echo "Training Trace adapter with MLX..."
"$PYTHON" -m mlx_lm lora \
  --model "$MODEL" \
  --train \
  --data "$OUTPUT_DIR" \
  --mask-prompt \
  --adapter-path "$ADAPTER_PATH" \
  --iters "$ITERS" \
  --batch-size "$BATCH_SIZE" \
  --num-layers "$NUM_LAYERS" \
  --grad-checkpoint
