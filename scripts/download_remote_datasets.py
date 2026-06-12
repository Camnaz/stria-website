#!/usr/bin/env python3
"""
Download remote datasets for Trace corpus building, avoiding multiprocessing RLock issues.
Run this once to cache all remote data locally, then build corpus with --local-only.
"""
# Prevent multiprocessing RLock deadlocks in Hugging Face datasets library
import os
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["HF_DATASETS_NUM_PROC"] = "1"  # Disable multiprocessing in datasets library

# Force 'spawn' start method on macOS to avoid fork-safety issues with multiprocessing
import multiprocessing
try:
    multiprocessing.set_start_method("spawn", force=True)
except RuntimeError:
    pass  # Already set

import json
from pathlib import Path

def download_wambosec():
    """Download wambosec/prompt-injections"""
    try:
        from datasets import load_dataset
        print("Downloading wambosec/prompt-injections...")
        ds = load_dataset("wambosec/prompt-injections", split="train[:1500]")
        out_path = Path("datasets/cache/wambosec-prompt-injections.jsonl")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            for row in ds:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"  Saved {len(ds)} rows to {out_path}")
        return True
    except Exception as e:
        print(f"  Failed: {e}")
        return False

def download_jailbreakdb():
    """Download youbin2014/JailbreakDB"""
    try:
        from datasets import load_dataset
        print("Downloading youbin2014/JailbreakDB...")
        ds = load_dataset("youbin2014/JailbreakDB", split="train", streaming=True)
        out_path = Path("datasets/cache/jailbreak-db.jsonl")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        count = 0
        with open(out_path, "w") as f:
            for row in ds:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
                count += 1
                if count >= 2000:
                    break
        print(f"  Saved {count} rows to {out_path}")
        return True
    except Exception as e:
        print(f"  Failed: {e}")
        return False

def download_finguard():
    """Download nandhak12/finguard-finance-injection-dataset"""
    try:
        from datasets import load_dataset
        print("Downloading nandhak12/finguard-finance-injection-dataset...")
        ds = load_dataset("nandhak12/finguard-finance-injection-dataset", split="train[:2500]")
        out_path = Path("datasets/cache/finguard-finance.jsonl")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            for row in ds:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"  Saved {len(ds)} rows to {out_path}")
        return True
    except Exception as e:
        print(f"  Failed: {e}")
        return False

def download_banking77():
    """Download Banking77 from raw CSV"""
    try:
        import requests
        import csv
        from io import StringIO
        
        print("Downloading Banking77 CSV...")
        url = "https://raw.githubusercontent.com/PolyAI-LDN/task-specific-datasets/master/banking_data/train.csv"
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        
        out_path = Path("datasets/cache/banking77.jsonl")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        
        reader = csv.DictReader(StringIO(resp.text))
        rows = list(reader)[:2500]
        
        with open(out_path, "w") as f:
            for row in rows:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"  Saved {len(rows)} rows to {out_path}")
        return True
    except Exception as e:
        print(f"  Failed: {e}")
        return False

def main():
    print("=" * 60)
    print("Downloading remote datasets for Trace corpus (sequential)")
    print("=" * 60)
    
    results = {
        "wambosec-prompt-injections": download_wambosec(),
        "jailbreak-db": download_jailbreakdb(),
        "finguard-finance": download_finguard(),
        "banking77": download_banking77(),
    }
    
    print("\n" + "=" * 60)
    print("Summary:")
    for name, success in results.items():
        status = "✓" if success else "✗"
        print(f"  {status} {name}")
    print("=" * 60)

if __name__ == "__main__":
    main()