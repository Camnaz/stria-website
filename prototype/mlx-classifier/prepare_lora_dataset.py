#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

SYSTEM_PROMPT = """You are the Trace usage-intelligence adapter.
Classify managed enterprise AI usage and return compact JSON with:
intent_classification, domain_alignment, risk_level, risk_signals.
"""


def to_chat_example(row: dict) -> dict:
    query = row["query"]
    response_preview = row.get("response_preview", "")
    user_content = {
        "query": query,
        "response_preview": response_preview,
        "business_context": "enterprise AI governance, finance operations, compliance, security, engineering, and education administration",
    }
    assistant_content = {
        "intent_classification": row["intent_classification"],
        "domain_alignment": row["domain_alignment"],
        "risk_level": row["risk_level"],
        "risk_signals": row["risk_signals"],
    }
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(user_content, sort_keys=True)},
            {"role": "assistant", "content": json.dumps(assistant_content, sort_keys=True)},
        ]
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare Trace usage examples for a local LoRA adapter dataset.")
    parser.add_argument("--input", default="datasets/usage-intelligence.jsonl")
    parser.add_argument("--output", default="datasets/usage-intelligence-lora.jsonl")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    rows = [json.loads(line) for line in input_path.read_text().splitlines() if line.strip()]
    output_path.write_text("\n".join(json.dumps(to_chat_example(row), sort_keys=True) for row in rows) + "\n")
    print(json.dumps({"input": str(input_path), "output": str(output_path), "examples": len(rows)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
