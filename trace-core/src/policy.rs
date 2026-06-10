//! Policy evaluation engine - core rule evaluation logic
//!
//! Implements 7 detector types matching TypeScript:
//! - payment_threshold
//! - tool_forbidden
//! - resource_delete
//! - network_allowlist
//! - managed_ai_usage_review
//! - pii
//! - token_leakage

use crate::types::*;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Evaluate identity capabilities against a tool call
pub fn verify_identity(
    identity: &AgentIdentity,
    call: &AgentToolCallInternal,
) -> Vec<RuleEvaluationResult> {
    let allowed = identity.allowed_tool_capabilities.iter().any(|cap| {
        cap.namespace == call.tool_namespace
            && cap.tool == call.tool_name
            && cap.action == call.action
    });

    if allowed {
        return Vec::new();
    }

    vec![RuleEvaluationResult {
        policy_id: "identity".to_string(),
        policy_version: identity.identity_version.clone(),
        rule_id: "identity-capability-denial".to_string(),
        rule_mode: "enforce".to_string(),
        result: "block".to_string(),
        reason: format!(
            "agent identity does not allow {}.{}:{}",
            call.tool_namespace, call.tool_name, call.action
        ),
        severity: "critical".to_string(),
    }]
}

/// Evaluate all policy rules against a tool call
pub fn evaluate_policy(
    policy: &PolicySpecInternal,
    call: &AgentToolCallInternal,
) -> Vec<RuleEvaluationResult> {
    policy
        .rules
        .iter()
        .filter_map(|rule| evaluate_rule(policy, rule, call))
        .collect()
}

/// Evaluate a single rule
pub fn evaluate_rule(
    policy: &PolicySpecInternal,
    rule: &PolicyRuleInternal,
    call: &AgentToolCallInternal,
) -> Option<RuleEvaluationResult> {
    let mode = rule.rule_mode.as_deref().unwrap_or(&policy.global_mode);

    match rule.detector.as_str() {
        "payment_threshold" => evaluate_payment_threshold(policy, rule, mode, call),
        "tool_forbidden" => evaluate_forbidden_tool(policy, rule, mode, call),
        "resource_delete" => evaluate_resource_deletion(policy, rule, mode, call),
        "network_allowlist" => evaluate_network_allowlist(policy, rule, mode, call),
        "managed_ai_usage_review" => evaluate_managed_ai_usage(policy, rule, mode, call),
        "pii" => {
            if contains_pii(&call.arguments) {
                Some(triggered(policy, rule, mode))
            } else {
                Some(passed(policy, rule, mode))
            }
        }
        "token_leakage" => {
            if contains_token_leakage(&call.arguments) {
                Some(triggered(policy, rule, mode))
            } else {
                Some(passed(policy, rule, mode))
            }
        }
        _ => None,
    }
}

fn evaluate_payment_threshold(
    policy: &PolicySpecInternal,
    rule: &PolicyRuleInternal,
    mode: &str,
    call: &AgentToolCallInternal,
) -> Option<RuleEvaluationResult> {
    let amount = call
        .arguments
        .get("amount_usd")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let threshold = rule.threshold_usd.unwrap_or(f64::INFINITY);

    if amount > threshold {
        Some(triggered(policy, rule, mode))
    } else {
        Some(passed(policy, rule, mode))
    }
}

fn evaluate_forbidden_tool(
    policy: &PolicySpecInternal,
    rule: &PolicyRuleInternal,
    mode: &str,
    call: &AgentToolCallInternal,
) -> Option<RuleEvaluationResult> {
    let forbidden = rule
        .forbidden_tools
        .iter()
        .any(|tool| tool.namespace == call.tool_namespace && tool.tool == call.tool_name);

    if forbidden {
        Some(triggered(policy, rule, mode))
    } else {
        Some(passed(policy, rule, mode))
    }
}

fn evaluate_resource_deletion(
    policy: &PolicySpecInternal,
    rule: &PolicyRuleInternal,
    mode: &str,
    call: &AgentToolCallInternal,
) -> Option<RuleEvaluationResult> {
    if call.action != "delete" {
        return Some(passed(policy, rule, mode));
    }

    let deletion = call
        .resources_modified
        .iter()
        .any(|resource| matches_any_pattern(resource, &rule.forbidden_resource_patterns));

    if deletion {
        Some(triggered(policy, rule, mode))
    } else {
        Some(passed(policy, rule, mode))
    }
}

fn evaluate_network_allowlist(
    policy: &PolicySpecInternal,
    rule: &PolicyRuleInternal,
    mode: &str,
    call: &AgentToolCallInternal,
) -> Option<RuleEvaluationResult> {
    let allowed = rule
        .allowed_destinations
        .contains(&call.network_destination);

    if allowed {
        Some(passed(policy, rule, mode))
    } else {
        Some(triggered(policy, rule, mode))
    }
}

fn evaluate_managed_ai_usage(
    policy: &PolicySpecInternal,
    rule: &PolicyRuleInternal,
    mode: &str,
    call: &AgentToolCallInternal,
) -> Option<RuleEvaluationResult> {
    let is_managed_ai_search =
        call.tool_namespace == "browser.web" && call.tool_name == "google.search";
    let risk_level = call
        .arguments
        .get("risk_level")
        .and_then(|v| v.as_str())
        .unwrap_or("low");
    let domain_alignment = call
        .arguments
        .get("domain_alignment")
        .and_then(|v| v.as_str())
        .unwrap_or("adjacent");

    let should_review =
        is_managed_ai_search && (risk_level == "high" || domain_alignment == "out_of_domain");

    if !should_review {
        return Some(passed(policy, rule, mode));
    }

    let severity = if risk_level == "high" { "high" } else { "medium" };

    Some(RuleEvaluationResult {
        policy_id: policy.policy_id.clone(),
        policy_version: policy.policy_version.clone(),
        rule_id: rule.id.clone(),
        rule_mode: mode.to_string(),
        result: if mode == "enforce" { "block" } else { "flag" }.to_string(),
        reason: rule.reason.clone(),
        severity: severity.to_string(),
    })
}

fn triggered(
    policy: &PolicySpecInternal,
    rule: &PolicyRuleInternal,
    mode: &str,
) -> RuleEvaluationResult {
    RuleEvaluationResult {
        policy_id: policy.policy_id.clone(),
        policy_version: policy.policy_version.clone(),
        rule_id: rule.id.clone(),
        rule_mode: mode.to_string(),
        result: if mode == "enforce" { "block" } else { "flag" }.to_string(),
        reason: rule.reason.clone(),
        severity: rule.severity.clone(),
    }
}

fn passed(
    policy: &PolicySpecInternal,
    rule: &PolicyRuleInternal,
    mode: &str,
) -> RuleEvaluationResult {
    RuleEvaluationResult {
        policy_id: policy.policy_id.clone(),
        policy_version: policy.policy_version.clone(),
        rule_id: rule.id.clone(),
        rule_mode: mode.to_string(),
        result: "pass".to_string(),
        reason: "rule did not trigger".to_string(),
        severity: "info".to_string(),
    }
}

/// Check for PII (SSN pattern)
pub fn contains_pii(args: &HashMap<String, serde_json::Value>) -> bool {
    let json_str = serde_json::to_string(args).unwrap_or_default();
    PII_REGEX.is_match(&json_str)
}

/// Check for token leakage patterns
pub fn contains_token_leakage(args: &HashMap<String, serde_json::Value>) -> bool {
    let json_str = serde_json::to_string(args).unwrap_or_default();
    TOKEN_LEAKAGE_REGEX.is_match(&json_str)
}

/// Match resource against glob-style patterns
fn matches_any_pattern(value: &str, patterns: &[String]) -> bool {
    patterns.iter().any(|pattern| {
        let regex_pattern = pattern
            .split('*')
            .map(regex::escape)
            .collect::<Vec<_>>()
            .join(".*");
        let regex = format!("^{}$", regex_pattern);
        Regex::new(&regex)
            .map(|re| re.is_match(value))
            .unwrap_or(false)
    })
}

// Pre-compiled regexes for performance
lazy_static::lazy_static! {
    static ref PII_REGEX: Regex = Regex::new(r"\b\d{3}-\d{2}-\d{4}\b").unwrap();
    static ref TOKEN_LEAKAGE_REGEX: Regex = Regex::new(r"(?i)bearer\s+[a-z0-9._-]+|sk-[a-z0-9_-]{12,}").unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample_identity() -> AgentIdentity {
        AgentIdentity {
            identity_version: "2026-06-04.1".to_string(),
            agent_uuid: "7e62b14f-0e6f-4b8c-91e7-4c39f7d3a210".to_string(),
            agent_id: "accounts-payable-agent-17".to_string(),
            organization_id: "org_stria_demo_finance".to_string(),
            environment: "production".to_string(),
            owner: Owner {
                name: "Maya Chen".to_string(),
                email: "maya.chen@stria-demo.example".to_string(),
                team: "Finance Operations".to_string(),
            },
            service_account_mappings: vec![],
            allowed_tool_capabilities: vec![ToolCapability {
                namespace: "finance.ap".to_string(),
                tool: "payment_draft.create".to_string(),
                action: "create".to_string(),
            }],
            allowed_network_destinations: vec![],
            allowed_resource_scopes: vec![],
            denied_tool_capabilities: vec![],
        }
    }

    fn sample_call_internal() -> AgentToolCallInternal {
        AgentToolCallInternal {
            request_id: "test_123".to_string(),
            agent_id: "accounts-payable-agent-17".to_string(),
            prompt: "Create payment".to_string(),
            model_provider: "openai".to_string(),
            model_name: "gpt-5".to_string(),
            model_config: HashMap::new(),
            parent_context: None,
            tool_namespace: "finance.ap".to_string(),
            tool_name: "payment_draft.create".to_string(),
            action: "create".to_string(),
            arguments: {
                let mut map = HashMap::new();
                map.insert("amount_usd".to_string(), json!(12500));
                map
            },
            resources_targeted: vec![],
            resources_modified: vec![],
            network_destination: "api.bank-sandbox.example".to_string(),
            received_timestamp: "2026-06-04T14:00:00.000Z".to_string(),
        }
    }

    fn sample_policy_internal() -> PolicySpecInternal {
        PolicySpecInternal {
            policy_id: "pol_test".to_string(),
            policy_version: "1.0".to_string(),
            global_mode: "observe".to_string(),
            rules: vec![PolicyRuleInternal {
                id: "payment-threshold".to_string(),
                description: "Test".to_string(),
                rule_mode: Some("observe".to_string()),
                interrupt: "soft".to_string(),
                severity: "high".to_string(),
                detector: "payment_threshold".to_string(),
                reason: "threshold exceeded".to_string(),
                threshold_usd: Some(10000.0),
                forbidden_tools: vec![],
                forbidden_resource_patterns: vec![],
                allowed_destinations: vec![],
            }],
        }
    }

    #[test]
    fn test_verify_identity_allowed() {
        let identity = sample_identity();
        let call = sample_call_internal();
        let result = verify_identity(&identity, &call);
        assert!(result.is_empty());
    }

    #[test]
    fn test_verify_identity_denied() {
        let mut identity = sample_identity();
        identity.allowed_tool_capabilities.clear();
        let call = sample_call_internal();
        let result = verify_identity(&identity, &call);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].result, "block");
        assert_eq!(result[0].rule_id, "identity-capability-denial");
    }

    #[test]
    fn test_payment_threshold_exceeded() {
        let policy = sample_policy_internal();
        let mut call = sample_call_internal();
        call.arguments.insert("amount_usd".to_string(), json!(15000));
        let results = evaluate_policy(&policy, &call);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].result, "flag");
    }

    #[test]
    fn test_payment_threshold_not_exceeded() {
        let policy = sample_policy_internal();
        let mut call = sample_call_internal();
        call.arguments.insert("amount_usd".to_string(), json!(5000));
        let results = evaluate_policy(&policy, &call);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].result, "pass");
    }

    #[test]
    fn test_contains_pii() {
        let mut args = HashMap::new();
        args.insert("ssn".to_string(), json!("123-45-6789"));
        assert!(contains_pii(&args));

        let mut args2 = HashMap::new();
        args2.insert("name".to_string(), json!("John"));
        assert!(!contains_pii(&args2));
    }

    #[test]
    fn test_contains_token_leakage() {
        let mut args = HashMap::new();
        args.insert("token".to_string(), json!("bearer abc123"));
        assert!(contains_token_leakage(&args));

        let mut args2 = HashMap::new();
        // sk- followed by 12+ characters to match the regex
        args2.insert("api_key".to_string(), json!("sk-abcdefghijkl"));
        assert!(contains_token_leakage(&args2));

        let mut args3 = HashMap::new();
        args3.insert("name".to_string(), json!("John"));
        assert!(!contains_token_leakage(&args3));
    }
}