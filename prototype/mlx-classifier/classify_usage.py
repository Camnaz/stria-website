#!/usr/bin/env python3
import argparse
import json
import re
import sys
from typing import Optional

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
    """Robustly extract JSON from model output, handling truncation and extra text."""
    # First try: find first { and parse with raw_decode
    match = re.search(r"\{", text)
    if match:
        decoder = json.JSONDecoder()
        try:
            parsed, _ = decoder.raw_decode(text[match.start():])
            return parsed
        except json.JSONDecodeError:
            pass
    
    # Second try: find last complete JSON object by balancing braces
    brace_count = 0
    start_idx = -1
    for i, ch in enumerate(text):
        if ch == '{':
            if brace_count == 0:
                start_idx = i
            brace_count += 1
        elif ch == '}':
            brace_count -= 1
            if brace_count == 0 and start_idx != -1:
                candidate = text[start_idx:i+1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    continue
    
    # Third try: regex search for balanced-like JSON
    for match in re.finditer(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text):
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            continue
    
    raise ValueError(f"model did not return valid JSON. Output: {text[:200]}")


def classify_with_mlx(query: str, model_name: str, adapter_path: Optional[str] = None) -> dict:
    try:
        from mlx_lm import generate, load
    except ImportError as error:
        raise SystemExit(
            "mlx-lm is not installed. Run: pip install -r prototype/mlx-classifier/requirements.txt"
        ) from error

    model, tokenizer = load(model_name, adapter_path=adapter_path)
    prompt = tokenizer.apply_chat_template(build_messages(query), tokenize=False, add_generation_prompt=True)
    output = generate(model, tokenizer, prompt=prompt, max_tokens=512, verbose=False)
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
