//! Trace Core - High-performance Rust implementation of Trace backend
//!
//! Provides N-API bindings for Node.js/TypeScript integration.

pub mod canonical_json;
pub mod evidence;
pub mod hash;
pub mod policy;
pub mod redact;
pub mod types;
pub mod usage_intel;

use napi::bindgen_prelude::*;
use napi_derive::napi;

// Re-export core modules
use canonical_json::{sort_for_canonical_json, value_to_canonical_json};
use evidence::run_trace_simulation;
use hash::{hash_evidence_record, sha256_any, sha256_str, sha256_value, sign_record_stub};
use policy::{evaluate_policy, verify_identity};
use redact::redacted_preview;
use types::*;
use usage_intel::analyze_usage_intent;

/// Canonical JSON functions - use String for JSON input/output
#[napi]
pub fn canonical_json_sort(value: String) -> String {
    let parsed: serde_json::Value = serde_json::from_str(&value).unwrap_or(serde_json::Value::Null);
    let sorted = sort_for_canonical_json(&parsed);
    sorted.to_string()
}

#[napi]
pub fn canonical_json_serialize(value: String) -> String {
    let parsed: serde_json::Value = serde_json::from_str(&value).unwrap_or(serde_json::Value::Null);
    value_to_canonical_json(&parsed)
}

/// Hash functions
#[napi]
pub fn hash_sha256_str(input: String) -> String {
    sha256_str(&input)
}

#[napi]
pub fn hash_sha256_value(value: String) -> String {
    let parsed: serde_json::Value = serde_json::from_str(&value).unwrap_or(serde_json::Value::Null);
    sha256_value(&parsed)
}

#[napi]
pub fn hash_sha256_any(value: String) -> String {
    let parsed: serde_json::Value = serde_json::from_str(&value).unwrap_or(serde_json::Value::Null);
    sha256_any(&parsed)
}

#[napi]
pub fn hash_evidence_record_napi(record: String) -> Result<String> {
    let parsed: serde_json::Value = serde_json::from_str(&record).unwrap_or(serde_json::Value::Null);
    hash_evidence_record(&parsed).map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
}

#[napi]
pub fn hash_sign_record_stub(record_hash: String) -> String {
    sign_record_stub(&record_hash)
}

/// Policy evaluation functions
#[napi]
pub fn policy_verify_identity(
    identity: AgentIdentity,
    call: AgentToolCall,
) -> Vec<EvaluationLedgerEntry> {
    let call_internal = call.to_internal().unwrap();
    let results = verify_identity(&identity, &call_internal);
    results.into_iter().map(|e| EvaluationLedgerEntry {
        policy_id: e.policy_id,
        policy_version: e.policy_version,
        rule_id: e.rule_id,
        rule_mode: e.rule_mode,
        result: e.result,
        reason: e.reason,
        severity: e.severity,
    }).collect()
}

#[napi]
pub fn policy_evaluate(
    policy: PolicySpec,
    call: AgentToolCall,
) -> Vec<EvaluationLedgerEntry> {
    let call_internal = call.to_internal().unwrap();
    let policy_internal = PolicySpecInternal {
        policy_id: policy.policy_id,
        policy_version: policy.policy_version,
        global_mode: policy.global_mode,
        rules: policy.rules.into_iter().map(|r| {
            PolicyRuleInternal {
                id: r.id,
                description: r.description,
                rule_mode: r.rule_mode,
                interrupt: r.interrupt,
                severity: r.severity,
                detector: r.detector,
                reason: r.reason,
                threshold_usd: r.threshold_usd,
                forbidden_tools: r.forbidden_tools,
                forbidden_resource_patterns: r.forbidden_resource_patterns,
                allowed_destinations: r.allowed_destinations,
            }
        }).collect(),
    };
    let results = evaluate_policy(&policy_internal, &call_internal);
    results.into_iter().map(|e| EvaluationLedgerEntry {
        policy_id: e.policy_id,
        policy_version: e.policy_version,
        rule_id: e.rule_id,
        rule_mode: e.rule_mode,
        result: e.result,
        reason: e.reason,
        severity: e.severity,
    }).collect()
}

/// Redaction function
#[napi]
pub fn redact_arguments(args: String) -> String {
    let parsed: serde_json::Value = serde_json::from_str(&args).unwrap_or(serde_json::Value::Object(serde_json::Map::new()));
    if let serde_json::Value::Object(map) = parsed {
        let redacted = redacted_preview(&map);
        serde_json::to_string(&serde_json::Value::Object(redacted)).unwrap_or("{}".to_string())
    } else {
        args
    }
}

/// Usage intelligence
#[napi]
pub fn usage_intel_analyze(query: String) -> Result<UsageIntelligence> {
    analyze_usage_intent(&query).map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
}

/// Main trace simulation entry point
#[napi]
pub fn trace_simulate(
    identity: AgentIdentity,
    policy: PolicySpec,
    call: AgentToolCall,
    previous_record_hash: Option<String>,
    evaluated_timestamp: String,
    emitted_timestamp: String,
) -> Result<SimulationResult> {
    let call_internal = call.to_internal().map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
    let policy_internal = PolicySpecInternal {
        policy_id: policy.policy_id,
        policy_version: policy.policy_version,
        global_mode: policy.global_mode,
        rules: policy.rules.into_iter().map(|r| {
            PolicyRuleInternal {
                id: r.id,
                description: r.description,
                rule_mode: r.rule_mode,
                interrupt: r.interrupt,
                severity: r.severity,
                detector: r.detector,
                reason: r.reason,
                threshold_usd: r.threshold_usd,
                forbidden_tools: r.forbidden_tools,
                forbidden_resource_patterns: r.forbidden_resource_patterns,
                allowed_destinations: r.allowed_destinations,
            }
        }).collect(),
    };
    let result = run_trace_simulation(
        &identity,
        &policy_internal,
        &call_internal,
        previous_record_hash,
        &evaluated_timestamp,
        &emitted_timestamp,
    ).map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
    
    // Convert internal types to public types
    Ok(convert_simulation_result(result))
}

/// Convert internal simulation result to public types for N-API
fn convert_simulation_result(internal: SimulationResultInternal) -> SimulationResult {
    SimulationResult {
        mode: internal.mode,
        action_allowed: internal.action_allowed,
        agent_response: internal.agent_response,
        evidence_record: convert_evidence_record(internal.evidence_record),
    }
}

fn convert_evidence_record(internal: EvidenceRecordInternal) -> EvidenceRecord {
    EvidenceRecord {
        record_id: internal.record_id,
        organization_id: internal.organization_id,
        environment: internal.environment,
        agent_id: internal.agent_id,
        agent_identity_version: internal.agent_identity_version,
        human_owner_operator: internal.human_owner_operator,
        action_allowed: internal.action_allowed,
        standardized_error: internal.standardized_error,
        ingress_envelope: internal.ingress_envelope,
        action_payload: convert_action_payload(internal.action_payload),
        evaluation_ledger: internal.evaluation_ledger,
        chain_of_custody: internal.chain_of_custody,
    }
}

fn convert_action_payload(internal: ActionPayloadInternal) -> ActionPayload {
    ActionPayload {
        tool_name: internal.tool_name,
        tool_namespace: internal.tool_namespace,
        arguments_hash: internal.arguments_hash,
        redacted_arguments_preview_json: serde_json::to_string(&internal.redacted_arguments_preview).unwrap_or("{}".to_string()),
        resources_targeted: internal.resources_targeted,
        resources_modified: internal.resources_modified,
    }
}

// N-API module initialization
#[napi]
pub fn init() {
    // Module initialization if needed
}