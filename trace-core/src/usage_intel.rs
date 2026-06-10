//! Usage Intelligence - Intent classification and risk scoring for prompts
//!
//! Matches the TypeScript implementation exactly with pre-compiled regexes
//! for high-performance pattern matching.

use crate::types::{TraceCoreError, UsageIntelligence};
use once_cell::sync::Lazy;
use regex::Regex;
use std::collections::HashSet;

/// Pre-compiled regex patterns for classification
static BUSINESS_TERMS: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    [
        "agent",
        "ai",
        "approval",
        "audit",
        "compliance",
        "contract",
        "customer",
        "evidence",
        "finance",
        "invoice",
        "legal",
        "payment",
        "policy",
        "refund",
        "renewal",
        "risk",
        "security",
        "support",
        "vendor",
        "workflow",
    ]
    .into_iter()
    .collect()
});

// Unsafe security patterns (offensive)
static UNSAFE_SECURITY_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"\b(hack|steal|phish|phishing|malware|ransomware|bypass|jailbreak|prompt injection|ignore previous|credential|credentials|keylogger|exploit|evade|exfiltrate|data exfiltration|sql injection|credential stuffing|delete logs|disable logging|cover tracks|backdoor|privilege escalation)\b"
    ).unwrap()
});

// Insider risk patterns
static INSIDER_RISK_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"\b(sabotage|sabotaging|harm my company|hurt my employer|damage my employer|damage my company|disrupt company operations|take down company systems|destroy company data|leak confidential|leak company data|retaliate against my employer|retaliate against my company|insider threat)\b"
    ).unwrap()
});

// Defensive security patterns (legitimate)
static DEFENSIVE_SECURITY_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"\b(detect|prevent|defend|defense|training|awareness|policy|incident response|security review|monitor|mitigate|protect|audit)\b"
    ).unwrap()
});

// Personal use patterns
static PERSONAL_USE_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"\b(resume|dating|sports betting|gambling|celebrity gossip|movie streaming|personal vacation)\b"
    ).unwrap()
});

// Academic integrity patterns
static ACADEMIC_INTEGRITY_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"\b(write my|do my|complete my|cannot detect ai|undetectable ai|cheat|plagiarize)\b.*\b(essay|exam|assignment|homework|teacher|university|school)\b|\b(essay|exam|assignment|homework|teacher|university|school)\b.*\b(write my|do my|complete my|cannot detect ai|undetectable ai|cheat|plagiarize)\b"
    ).unwrap()
});

// Policy violation patterns
static POLICY_VIOLATION_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"\b(without human approval|without manager approval|without approval|without change approval|modify vendor payment|production database deletion|delete production|external summarizer|outside allowed network|supervisor signature|above 10000|above threshold)\b"
    ).unwrap()
});

// Trace plane / governance patterns
static TRACE_PLANE_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"\b(data plane|control plane|trust plane|merkle root|evidence record|evidence hash|agent identity|policy owner|audit-ready evidence|control evidence|review bottleneck|over restrictive|ciso|general counsel|compliance|ai platform team)\b"
    ).unwrap()
});

// Governance review patterns
static GOVERNANCE_REVIEW_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"\b(ciso|general counsel|compliance|policy owner|audit-ready|control evidence|agents? violated|data deletion policy|review bottlenecks?|ai platform team)\b"
    ).unwrap()
});

// Sensitive data patterns
static SENSITIVE_DATA_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"\b(api keys?|password|secret|tokens?|bearer tokens?|access tokens?|customer data|company data|confidential company data|confidential data|ssn|social security|credit card|account number|account numbers|private data|private key|ssh key)\b"
    ).unwrap()
});

// Technical workflow patterns
static TECHNICAL_WORKFLOW_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"\b(api|code|script|debug|error|deploy|database|schema|github|terminal|typescript|webhook|queue|incident response|security review|cloud|admin console|production)\b"
    ).unwrap()
});

// Business sensitive terms
static BUSINESS_SENSITIVE_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"\b(agent|ai|evidence|invoice|payment|vendor|contract|legal|policy|compliance|audit|risk|customer|refund|support|renewal|approval|exception|workflow|quote|sales|procurement)\b"
    ).unwrap()
});

// Education patterns
static EDUCATION_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b(student|school|university|assignment|homework|exam|essay|teacher|academic)\b")
        .unwrap()
});

// Arithmetic patterns (for general research baseline)
static ARITHMETIC_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^\s*(what is\s*)?-?\d+(?:\.\d+)?\s*(?:x|\*|×|\+|-|/)\s*-?\d+(?:\.\d+)?\b").unwrap()
});

/// Analyze usage intent from a query string
pub fn analyze_usage_intent(query: &str) -> Result<UsageIntelligence, TraceCoreError> {
    let normalized = query.to_lowercase();
    let mut risk_signals = Vec::new();

    // Check insider risk
    if INSIDER_RISK_PATTERN.is_match(&normalized) {
        risk_signals.push("insider_threat_or_sabotage_intent".to_string());
    }

    // Check unsafe security (not defensive)
    let unsafe_match = UNSAFE_SECURITY_PATTERN.is_match(&normalized);
    let defensive_match = DEFENSIVE_SECURITY_PATTERN.is_match(&normalized);

    if unsafe_match && !defensive_match {
        risk_signals.push("potentially_malicious_security_intent".to_string());
    }

    // Defensive security context
    if unsafe_match && defensive_match {
        risk_signals.push("defensive_security_review_context".to_string());
    }

    // Personal use
    if PERSONAL_USE_PATTERN.is_match(&normalized) {
        risk_signals.push("likely_unrelated_personal_use".to_string());
    }

    // Academic integrity
    if ACADEMIC_INTEGRITY_PATTERN.is_match(&normalized) {
        risk_signals.push("possible_academic_integrity_violation".to_string());
    }

    // Policy violation
    if POLICY_VIOLATION_PATTERN.is_match(&normalized) {
        risk_signals.push("policy_violation_or_approval_gap".to_string());
    }

    // Sensitive data exposure
    if SENSITIVE_DATA_PATTERN.is_match(&normalized) {
        risk_signals.push("possible_sensitive_data_exposure".to_string());
    }

    // Classify intent
    let intent = classify_search_intent(&normalized);

    // Classify domain alignment
    let domain_alignment = classify_domain_alignment(&normalized, &intent, &risk_signals);

    // Determine risk level
    let risk_level = determine_risk_level(&risk_signals, &domain_alignment);

    let intent_clone = intent.clone();
    let risk_signals_clone = risk_signals.clone();
    Ok(UsageIntelligence {
        llm_usage_detected: true,
        llm_surface: "google_search_with_gemini_available".to_string(),
        intent_classification: intent,
        domain_alignment,
        risk_level,
        risk_signals,
        operator_narrative: narrative_for(&intent_clone, &risk_signals_clone),
        recommended_workflow: recommended_workflow(&intent_clone, &risk_signals_clone),
    })
}

fn classify_search_intent(normalized: &str) -> String {
    if PERSONAL_USE_PATTERN.is_match(normalized) {
        return "general_research".to_string();
    }

    if INSIDER_RISK_PATTERN.is_match(normalized) {
        return "potentially_malicious_or_unsafe".to_string();
    }

    let unsafe_match = UNSAFE_SECURITY_PATTERN.is_match(normalized);
    let defensive_match = DEFENSIVE_SECURITY_PATTERN.is_match(normalized);

    if unsafe_match && !defensive_match {
        return "potentially_malicious_or_unsafe".to_string();
    }

    if unsafe_match && defensive_match {
        return "technical_workflow".to_string();
    }

    if EDUCATION_PATTERN.is_match(normalized) {
        return "education_workflow".to_string();
    }

    if TRACE_PLANE_PATTERN.is_match(normalized)
        || GOVERNANCE_REVIEW_PATTERN.is_match(normalized)
        || POLICY_VIOLATION_PATTERN.is_match(normalized)
    {
        return "business_sensitive_workflow".to_string();
    }

    if TECHNICAL_WORKFLOW_PATTERN.is_match(normalized) {
        return "technical_workflow".to_string();
    }

    if ARITHMETIC_PATTERN.is_match(normalized) {
        return "general_research".to_string();
    }

    if BUSINESS_SENSITIVE_PATTERN.is_match(normalized) {
        return "business_sensitive_workflow".to_string();
    }

    "general_research".to_string()
}

fn classify_domain_alignment(normalized: &str, intent: &str, risk_signals: &[String]) -> String {
    if risk_signals
        .iter()
        .any(|s| s == "likely_unrelated_personal_use")
    {
        return "out_of_domain".to_string();
    }
    if intent == "potentially_malicious_or_unsafe" {
        return "out_of_domain".to_string();
    }
    if intent == "education_workflow" {
        return "adjacent".to_string();
    }
    if BUSINESS_TERMS.iter().any(|term| normalized.contains(term)) {
        return "in_domain".to_string();
    }
    if intent == "technical_workflow" {
        return "adjacent".to_string();
    }
    "adjacent".to_string()
}

fn determine_risk_level(risk_signals: &[String], domain_alignment: &str) -> String {
    let has_high_risk = risk_signals.iter().any(|signal| {
        signal.contains("malicious")
            || signal.contains("sensitive")
            || signal.contains("policy_violation")
            || signal.contains("insider_threat")
    });

    if has_high_risk {
        "high".to_string()
    } else if !risk_signals.is_empty() || domain_alignment == "out_of_domain" {
        "medium".to_string()
    } else {
        "low".to_string()
    }
}

fn narrative_for(intent: &str, risk_signals: &[String]) -> String {
    if intent == "potentially_malicious_or_unsafe" {
        if risk_signals
            .iter()
            .any(|s| s == "insider_threat_or_sabotage_intent")
        {
            return "The query resembles adverse insider intent. Trace should preserve evidence, avoid providing operational harm guidance, and route the event for security or compliance review.".to_string();
        }
        return "The query resembles unsafe or malicious security research. Trace should preserve evidence and route the event for security review.".to_string();
    }

    if risk_signals
        .iter()
        .any(|s| s == "possible_sensitive_data_exposure")
    {
        return "The query may include sensitive material. Trace should retain evidence and prompt an operator to review data exposure risk.".to_string();
    }

    if risk_signals
        .iter()
        .any(|s| s == "likely_unrelated_personal_use")
    {
        return "The query appears unrelated to approved business or academic workflows. Trace should record the usage pattern for policy review.".to_string();
    }

    if intent == "business_sensitive_workflow" {
        return "The query appears tied to business-sensitive work. Trace should preserve evidence and help operators evaluate whether policy or human review applies.".to_string();
    }

    if intent == "technical_workflow" {
        return "The query appears tied to technical work. Trace can help identify repeated troubleshooting patterns, tool usage, and workflow friction.".to_string();
    }

    if intent == "education_workflow" {
        return "The query appears tied to academic work. Trace can help administrators apply acceptable-use or academic-integrity policies.".to_string();
    }

    "The query appears to be general research. Trace records a baseline event and keeps the evidence available for later review.".to_string()
}

fn recommended_workflow(intent: &str, risk_signals: &[String]) -> String {
    let high_risk = risk_signals.iter().any(|signal| {
        signal.contains("malicious")
            || signal.contains("sensitive")
            || signal.contains("policy_violation")
            || signal.contains("insider_threat")
    });

    if high_risk {
        "Route to security or compliance review and retain evidence.".to_string()
    } else if risk_signals
        .iter()
        .any(|s| s == "likely_unrelated_personal_use")
    {
        "Record as out-of-domain usage and review against acceptable-use policy.".to_string()
    } else if intent == "business_sensitive_workflow" {
        "Retain evidence and review if sensitive business data appears.".to_string()
    } else if intent == "technical_workflow" {
        "Aggregate with developer workflow signals and inspect repeated friction.".to_string()
    } else if intent == "education_workflow" {
        "Review against institution-specific acceptable-use policy.".to_string()
    } else {
        "Record baseline usage and continue observing.".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analyze_insider_risk() {
        let result = analyze_usage_intent("how to sabotage my company").unwrap();
        assert_eq!(result.risk_level, "high");
        assert!(result
            .risk_signals
            .iter()
            .any(|s| s.contains("insider_threat")));
        assert_eq!(result.domain_alignment, "out_of_domain");
    }

    #[test]
    fn test_analyze_unsafe_security() {
        let result = analyze_usage_intent("how to hack a database").unwrap();
        assert_eq!(result.risk_level, "high");
        assert!(result.risk_signals.iter().any(|s| s.contains("malicious")));
    }

    #[test]
    fn test_analyze_defensive_security() {
        let result = analyze_usage_intent("how to detect sql injection attacks").unwrap();
        // Should be technical_workflow, not flagged as malicious
        assert_eq!(result.intent_classification, "technical_workflow");
    }

    #[test]
    fn test_analyze_personal_use() {
        let result = analyze_usage_intent("movie streaming sites").unwrap();
        assert_eq!(result.domain_alignment, "out_of_domain");
        assert!(result
            .risk_signals
            .iter()
            .any(|s| s.contains("personal_use")));
    }

    #[test]
    fn test_analyze_business_workflow() {
        let result = analyze_usage_intent("payment audit policy for agent approvals").unwrap();
        assert_eq!(result.intent_classification, "business_sensitive_workflow");
        assert_eq!(result.domain_alignment, "in_domain");
    }

    #[test]
    fn test_analyze_technical_workflow() {
        let result = analyze_usage_intent("debug database schema migration error").unwrap();
        assert_eq!(result.intent_classification, "technical_workflow");
        assert_eq!(result.domain_alignment, "adjacent");
    }

    #[test]
    fn test_analyze_general_research() {
        let result = analyze_usage_intent("what is 5 x 10").unwrap();
        assert_eq!(result.intent_classification, "general_research");
        assert_eq!(result.risk_level, "low");
    }
}
