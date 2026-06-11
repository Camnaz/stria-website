#!/usr/bin/env python3
import json
import sys
from pathlib import Path

sys.path.insert(0, "prototype/mlx-classifier")
from classify_usage import classify_with_mlx

ADAPTER_PATH = ".trace/adapters/trace-enterprise-full-600"
MODEL = "mlx-community/Qwen2.5-1.5B-Instruct-4bit"
INPUT_FILE = "datasets/trace-enterprise-full/test.jsonl"
OUTPUT_FILE = "datasets/trace-enterprise-full/adapter-predictions-full.jsonl"

def extract_query_from_test(record):
    for msg in record.get("messages", []):
        if msg["role"] == "user":
            import json as jsonlib
            content = jsonlib.loads(msg["content"])
            # Try multiple possible fields
            return content.get("query") or content.get("text") or content.get("user_message") or content.get("prompt") or content.get("input") or ""
    return ""

def main():
    test_records = [json.loads(line) for line in Path(INPUT_FILE).read_text().splitlines() if line.strip()]
    
    results = []
    for i, record in enumerate(test_records):
        query = extract_query_from_test(record)
        try:
            pred = classify_with_mlx(query, MODEL, ADAPTER_PATH)
            results.append(pred)
            print(f"[{i+1}/{len(test_records)}] {pred.get('intent_classification', '?')} | {pred.get('risk_level', '?')}")
        except Exception as e:
            print(f"[{i+1}/{len(test_records)}] ERROR: {e}")
            results.append({"error": str(e), "query": query})
    
    Path(OUTPUT_FILE).write_text("\n".join(json.dumps(r, sort_keys=True) for r in results) + "\n")
    print(f"\nSaved {len(results)} predictions to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()