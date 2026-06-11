#!/usr/bin/env python3
"""
Training Trigger: Monitors synthetic dataset size and triggers MLX LoRA fine-tuning.

Run via cron: 0 3 * * * /path/to/.venv-mlx/bin/python /path/to/train_trigger.py
"""
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Configuration
SYNTHETIC_DATASET_PATH = Path("datasets/synthetic_test_vectors.jsonl")
CONTINUOUS_LEARNING_PATH = Path("datasets/continuous_learning_dataset.jsonl")
TRIGGER_THRESHOLD = 500  # Number of synthetic samples to trigger retraining
LAST_TRAIN_MARKER = Path("datasets/.last_train_count")
MODEL_OUTPUT_DIR = Path(".trace/adapters")
MLX_TRAIN_SCRIPT = Path("scripts/train-trace-mlx.sh")

# Training config
TRAIN_CONFIG = {
    "iters": 600,
    "num_layers": 8,
    "batch_size": 1,
    "learning_rate": 1e-5,
}

def count_synthetic_samples() -> int:
    """Count total synthetic samples in the dataset."""
    if not SYNTHETIC_DATASET_PATH.exists():
        return 0
    with open(SYNTHETIC_DATASET_PATH) as f:
        return sum(1 for _ in f)

def get_last_train_count() -> int:
    """Get the sample count at last training."""
    if LAST_TRAIN_MARKER.exists():
        return int(LAST_TRAIN_MARKER.read_text().strip())
    return 0

def set_last_train_count(count: int) -> None:
    """Record the sample count at last training."""
    LAST_TRAIN_MARKER.write_text(str(count))

def should_train(current: int, last: int) -> bool:
    """Determine if training should be triggered."""
    return (current - last) >= TRIGGER_THRESHOLD

def generate_adapter_path() -> Path:
    """Generate unique adapter path with timestamp."""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return MODEL_OUTPUT_DIR / f"trace-enterprise-continual-{timestamp}"

def run_training(adapter_path: Path) -> bool:
    """Execute MLX LoRA training."""
    print(f"Starting MLX LoRA training...")
    print(f"  Adapter path: {adapter_path}")
    print(f"  Config: {TRAIN_CONFIG}")
    
    # Prepare dataset in the right format
    prepare_training_data()
    
    # Run training script
    cmd = [
        "bash", str(MLX_TRAIN_SCRIPT),
        "--local-only",
        "--iters", str(TRAIN_CONFIG["iters"]),
        "--num-layers", str(TRAIN_CONFIG["num_layers"]),
        "--adapter-path", str(adapter_path),
        "--output-dir", "datasets/trace-enterprise-full",
    ]
    
    env = os.environ.copy()
    env["TRACE_PYTHON"] = str(Path(".venv-mlx/bin/python").absolute())
    
    try:
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=3600)
        if result.returncode == 0:
            print(f"Training completed successfully!")
            print(result.stdout[-2000:])  # Last 2000 chars
            return True
        else:
            print(f"Training failed with return code {result.returncode}")
            print(f"STDERR: {result.stderr[-2000:]}")
            return False
    except subprocess.TimeoutExpired:
        print("Training timed out after 1 hour")
        return False
    except Exception as e:
        print(f"Training error: {e}")
        return False

def prepare_training_data() -> None:
    """Merge synthetic vectors with base dataset for training."""
    print("Preparing training data...")
    
    # Build corpus with local data (includes synthetic vectors)
    cmd = [
        ".venv-mlx/bin/python", "prototype/mlx-classifier/build_enterprise_corpus.py",
        "--local-only", "--output-dir", "datasets/trace-enterprise-full"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        print(f"Warning: Corpus build failed: {result.stderr}")
    else:
        print("Corpus rebuilt with synthetic data")

def hot_swap_model(new_adapter_path: Path) -> bool:
    """Signal the MLX server to hot-swap to new adapter."""
    # For now, just log the new adapter path
    # In production, this would call an API endpoint on the MLX server
    print(f"New adapter ready: {new_adapter_path}")
    print("To hot-swap: restart MLX server with:")
    print(f"  python -m mlx_lm.server --model mlx-community/Qwen2.5-1.5B-Instruct-4bit --adapter-path {new_adapter_path} --port 9001")
    return True

def main():
    print(f"[{datetime.now().isoformat()}] Checking training trigger...")
    
    current_count = count_synthetic_samples()
    last_count = get_last_train_count()
    
    print(f"  Current synthetic samples: {current_count}")
    print(f"  Last training count: {last_count}")
    print(f"  Threshold: {TRIGGER_THRESHOLD}")
    
    if not should_train(current_count, last_count):
        needed = TRIGGER_THRESHOLD - (current_count - last_count)
        print(f"  Not training yet. Need {needed} more samples.")
        return 0
    
    print(f"  THRESHOLD REACHED! Triggering training...")
    
    adapter_path = generate_adapter_path()
    
    if run_training(adapter_path):
        # Hot-swap
        hot_swap_model(adapter_path)
        
        # Update marker
        set_last_train_count(current_count)
        print(f"Training complete. Updated marker to {current_count}")
        return 0
    else:
        print("Training failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())