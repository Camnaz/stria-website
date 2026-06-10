#!/usr/bin/env python3
import argparse
import json
import re
import sys

DEFAULT_MODEL = "mlx-community/Qwen2.5-1.5B-Instruct-4bit"


SYSTEM_PROMPT = """You are the Trace usage-intelligence adapter.
Classify managed enterprise AI usage and return compact JSON with:
intent_classification, domain_alignment, risk_level, risk_signals, operator_narrative, recommended_workflow.
"""


def canonical_json(value: dict) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def build_messages(query: str) -> list[dict[str, str]]:
    user_content = {
        "business_context": "enterprise AI governance, finance operations, compliance, security, engineering, and education administration",
        "query": query,
        "response_preview": "",
        "source_id": "trace-cli",
        "source_kind": "local_inference",
    }
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": canonical_json(user_content)},
    ]


def extract_json(text: str) -> dict:
    match = re.search(r"\{", text)
    if not match:
        raise ValueError("model did not return JSON")
    decoder = json.JSONDecoder()
    parsed, _ = decoder.raw_decode(text[match.start() :])
    return parsed


def classify_with_mlx(query: str, model_name: str, adapter_path: str | None = None) -> dict:
    try:
        from mlx_lm import generate, load
    except ImportError as error:
        raise SystemExit(
            "mlx-lm is not installed. Run: pip install -r prototype/mlx-classifier/requirements.txt"
        ) from error

    model, tokenizer = load(model_name, adapter_path=adapter_path)
    prompt = tokenizer.apply_chat_template(build_messages(query), tokenize=False, add_generation_prompt=True)
    output = generate(model, tokenizer, prompt=prompt, max_tokens=260, verbose=False)
    parsed = extract_json(output)
    parsed["query"] = query
    parsed["model"] = model_name
    if adapter_path:
        parsed["adapter_path"] = adapter_path
    return parsed


def main() -> int:
    parser = argparse.ArgumentParser(description="Classify a managed AI-search query with a local MLX model.")
    parser.add_argument("query", help="Observed search query to classify.")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"MLX model id. Default: {DEFAULT_MODEL}")
    parser.add_argument("--adapter-path", default=None, help="Optional MLX LoRA adapter path.")
    args = parser.parse_args()

    result = classify_with_mlx(args.query, args.model, args.adapter_path)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
