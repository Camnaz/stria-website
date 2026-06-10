#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


def extract_query(row: dict[str, Any]) -> str:
    if "query" in row:
        return str(row["query"])
    if "messages" in row and isinstance(row["messages"], list) and len(row["messages"]) >= 2:
        user = row["messages"][-2]
        if isinstance(user, dict) and isinstance(user.get("content"), str):
            try:
                content = json.loads(user["content"])
            except json.JSONDecodeError:
                return user["content"]
            for key in ["query", "prompt", "input", "text", "user_message", "user_prompt"]:
                if content.get(key):
                    return str(content[key])
            return json.dumps(content, sort_keys=True)
    raise ValueError("could not extract query from row")


def classify(query: str) -> dict[str, Any]:
    normalized = query.lower()
    risk_signals: list[str] = []
    unsafe_security = re.search(r"\b(hack|steal|phish|phishing|malware|ransomware|bypass|jailbreak|prompt injection|ignore previous|credential|credentials|keylogger|exploit|evade|exfiltrate|data exfiltration|sql injection|credential stuffing|delete logs|disable logging|cover tracks|backdoor|privilege escalation)\b", normalized)
    insider_risk = re.search(r"\b(sabotage|sabotaging|harm my company|hurt my employer|damage my employer|damage my company|disrupt company operations|take down company systems|destroy company data|leak confidential|leak company data|retaliate against my employer|retaliate against my company|insider threat)\b", normalized)
    defensive_security = re.search(r"\b(detect|prevent|defend|defense|training|awareness|policy|incident response|security review|monitor|mitigate|protect|audit)\b", normalized)
    personal_use = re.search(r"\b(resume|dating|sports betting|gambling|celebrity gossip|movie streaming|personal vacation)\b", normalized)
    policy_violation = re.search(r"\b(without human approval|without manager approval|without approval|without change approval|modify vendor payment|production database deletion|delete production|external summarizer|outside allowed network|supervisor signature|above 10000|above threshold)\b", normalized)
    trace_plane = re.search(r"\b(data plane|control plane|trust plane|merkle root|evidence record|evidence hash|agent identity|policy owner|audit-ready evidence|control evidence|review bottleneck|over restrictive|ciso|general counsel|compliance|ai platform team)\b", normalized)
    governance_review = re.search(r"\b(ciso|general counsel|compliance|policy owner|audit-ready|control evidence|agents? violated|data deletion policy|review bottlenecks?|ai platform team)\b", normalized)
    academic_integrity = re.search(
        r"\b(write my|do my|complete my|cannot detect ai|undetectable ai|cheat|plagiarize)\b.*\b(essay|exam|assignment|homework|teacher|university|school)\b|\b(essay|exam|assignment|homework|teacher|university|school)\b.*\b(write my|do my|complete my|cannot detect ai|undetectable ai|cheat|plagiarize)\b",
        normalized,
    )

    if insider_risk:
        risk_signals.append("insider_threat_or_sabotage_intent")
    if unsafe_security and not defensive_security:
        risk_signals.append("potentially_malicious_security_intent")
    if unsafe_security and defensive_security:
        risk_signals.append("defensive_security_review_context")
    if personal_use:
        risk_signals.append("likely_unrelated_personal_use")
    if academic_integrity:
        risk_signals.append("possible_academic_integrity_violation")
    if policy_violation:
        risk_signals.append("policy_violation_or_approval_gap")
    if re.search(r"\b(api keys?|password|secret|tokens?|bearer tokens?|access tokens?|customer data|company data|confidential company data|confidential data|ssn|social security|credit card|account number|account numbers|private data|private key|ssh key)\b", normalized):
        risk_signals.append("possible_sensitive_data_exposure")

    intent = "general_research"
    if personal_use:
        intent = "general_research"
    elif insider_risk:
        intent = "potentially_malicious_or_unsafe"
    elif unsafe_security and not defensive_security:
        intent = "potentially_malicious_or_unsafe"
    elif unsafe_security and defensive_security:
        intent = "technical_workflow"
    elif re.search(r"\b(student|school|university|assignment|homework|exam|essay|teacher|academic)\b", normalized):
        intent = "education_workflow"
    elif trace_plane or governance_review or policy_violation:
        intent = "business_sensitive_workflow"
    elif re.search(r"\b(api|code|script|debug|error|deploy|database|schema|github|terminal|typescript|webhook|queue|incident response|security review|cloud|admin console|production)\b", normalized):
        intent = "technical_workflow"
    elif re.search(r"^\s*(what is\s*)?-?\d+(?:\.\d+)?\s*(?:x|\*|×|\+|-|/)\s*-?\d+(?:\.\d+)?\b", normalized):
        intent = "general_research"
    elif re.search(r"\b(agent|ai|evidence|invoice|payment|vendor|contract|legal|policy|compliance|audit|risk|customer|refund|support|renewal|approval|exception|workflow|quote|sales|procurement)\b", normalized):
        intent = "business_sensitive_workflow"

    if "likely_unrelated_personal_use" in risk_signals or intent == "potentially_malicious_or_unsafe":
        alignment = "out_of_domain"
    elif any(term in normalized for term in ["agent", "ai", "approval", "audit", "compliance", "contract", "customer", "evidence", "finance", "invoice", "legal", "payment", "policy", "refund", "renewal", "risk", "security", "support", "vendor", "workflow"]):
        alignment = "in_domain"
    elif intent in {"technical_workflow", "education_workflow"}:
        alignment = "adjacent"
    else:
        alignment = "adjacent"

    if any(signal in risk_signals for signal in ["potentially_malicious_security_intent", "insider_threat_or_sabotage_intent", "possible_sensitive_data_exposure", "policy_violation_or_approval_gap"]):
        risk = "high"
    elif risk_signals or alignment == "out_of_domain":
        risk = "medium"
    else:
        risk = "low"

    return {
        "query": query,
        "intent_classification": intent,
        "domain_alignment": alignment,
        "risk_level": risk,
        "risk_signals": risk_signals,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Create deterministic Trace baseline predictions for a usage dataset.")
    parser.add_argument("--input", default="datasets/trace-enterprise/test.jsonl")
    parser.add_argument("--output", default="datasets/trace-enterprise/baseline-predictions.jsonl")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    rows = [json.loads(line) for line in input_path.read_text().splitlines() if line.strip()]
    predictions = [classify(extract_query(row)) for row in rows]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(json.dumps(row, sort_keys=True) for row in predictions) + ("\n" if predictions else ""))
    print(json.dumps({"input": str(input_path), "output": str(output_path), "predictions": len(predictions)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
