#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from typing import Any


def label_from_row(row: dict[str, Any]) -> dict[str, Any]:
    if "messages" in row and isinstance(row["messages"], list) and row["messages"]:
        assistant = row["messages"][-1]
        if isinstance(assistant, dict) and isinstance(assistant.get("content"), str):
            parsed = json.loads(assistant["content"])
            user = row["messages"][-2] if len(row["messages"]) > 1 else {}
            user_content = {}
            if isinstance(user, dict) and isinstance(user.get("content"), str):
                try:
                    user_content = json.loads(user["content"])
                except json.JSONDecodeError:
                    user_content = {"query": user["content"]}
            parsed["query"] = (
                user_content.get("query")
                or user_content.get("prompt")
                or user_content.get("input")
                or user_content.get("text")
                or user_content.get("user_message")
                or user_content.get("user_prompt")
                or json.dumps(user_content, sort_keys=True)
            )
            return parsed
    return row


def normalize_prediction(row: dict) -> dict:
    if "prediction" in row and isinstance(row["prediction"], dict):
        return row["prediction"]
    return row


def accuracy(correct: int, total: int) -> float:
    return correct / total if total else 0


def safe_div(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Score Trace usage-classification predictions against labeled JSONL data.")
    parser.add_argument("--labels", default="datasets/usage-intelligence.jsonl")
    parser.add_argument("--predictions", default="datasets/usage-intelligence.jsonl")
    parser.add_argument("--min-intent-accuracy", type=float, default=0.0)
    parser.add_argument("--min-risk-accuracy", type=float, default=0.0)
    parser.add_argument("--min-high-risk-recall", type=float, default=0.0)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    labels = [label_from_row(json.loads(line)) for line in Path(args.labels).read_text().splitlines() if line.strip()]
    predictions = [normalize_prediction(json.loads(line)) for line in Path(args.predictions).read_text().splitlines() if line.strip()]
    by_query = {row["query"]: row for row in predictions}
    fields = ["intent_classification", "domain_alignment", "risk_level"]
    totals = {field: 0 for field in fields}
    correct = {field: 0 for field in fields}
    missing = 0
    label_distribution: dict[str, dict[str, int]] = {field: {} for field in fields}
    prediction_distribution: dict[str, dict[str, int]] = {field: {} for field in fields}
    high_risk_true_positive = 0
    high_risk_false_negative = 0
    high_risk_false_positive = 0

    for label in labels:
        for field in fields:
            label_value = str(label.get(field, "unknown"))
            label_distribution[field][label_value] = label_distribution[field].get(label_value, 0) + 1
        prediction = by_query.get(label["query"])
        if not prediction:
            missing += 1
            if label.get("risk_level") == "high":
                high_risk_false_negative += 1
            continue
        for field in fields:
            predicted_value = str(prediction.get(field, "unknown"))
            prediction_distribution[field][predicted_value] = prediction_distribution[field].get(predicted_value, 0) + 1
            totals[field] += 1
            if prediction.get(field) == label.get(field):
                correct[field] += 1
        if label.get("risk_level") == "high" and prediction.get("risk_level") == "high":
            high_risk_true_positive += 1
        elif label.get("risk_level") == "high":
            high_risk_false_negative += 1
        elif prediction.get("risk_level") == "high":
            high_risk_false_positive += 1

    metrics = {
        "examples": len(labels),
        "missing_predictions": missing,
        "accuracy": {
            field: accuracy(correct[field], totals[field])
            for field in fields
        },
        "high_risk": {
            "true_positive": high_risk_true_positive,
            "false_negative": high_risk_false_negative,
            "false_positive": high_risk_false_positive,
            "recall": safe_div(high_risk_true_positive, high_risk_true_positive + high_risk_false_negative),
            "precision": safe_div(high_risk_true_positive, high_risk_true_positive + high_risk_false_positive),
        },
        "label_distribution": label_distribution,
        "prediction_distribution": prediction_distribution,
    }
    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(json.dumps(metrics, indent=2, sort_keys=True) + "\n")
    print(json.dumps(metrics, indent=2, sort_keys=True))
    if metrics["accuracy"]["intent_classification"] < args.min_intent_accuracy:
        raise SystemExit("intent accuracy below minimum")
    if metrics["accuracy"]["risk_level"] < args.min_risk_accuracy:
        raise SystemExit("risk accuracy below minimum")
    if metrics["high_risk"]["recall"] < args.min_high_risk_recall:
        raise SystemExit("high-risk recall below minimum")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
