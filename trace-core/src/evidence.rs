//! Evidence record hashing and signing
//!
//! Handles the chain of custody hashing for evidence records.

use crate::hash::{hash_evidence_record, sha256_str, sign_record_stub};
use crate::policy::{evaluate_policy, verify_identity};
use crate::redact::redacted_preview_hashmap;
use crate::types::*;
use serde_json::Value;

const PROCESSING_NODE_ID: &str = "trace-local-node-001";

/// Build an evidence record from components
pub fn build_evidence_record(
    identity: &AgentIdentity,
    call: &AgentToolCallInternal,
    evaluation_ledger: &[EvaluationLedgerEntry],
    action_allowed: bool,
    standardized_error: Option<StandardizedAgentError>,
    previous_record_hash: Option<String>,
    evaluated_timestamp: &str,
    emitted_timestamp: &str,
) -> EvidenceRecordInternal {
    let record_id = format!("ev_{}", call.request_id);

    // Redact arguments - returns Value directly
    let args_preview = redacted_preview_hashmap(&call.arguments);

    let ingress_envelope = IngressEnvelope {
        prompt_hash: sha256_str(&call.prompt),
        model_provider: call.model_provider.clone(),
        model_name: call.model_name.clone(),
        model_config_hash: sha256_str(&serde_json::to_string(&call.model_config).unwrap_or_default()),
        parent_context_hash: sha256_str(
            &serde_json::to_string(&call.parent_context).unwrap_or_else(|_| "{}".to_string()),
        ),
    };

    let action_payload = ActionPayloadInternal {
        tool_name: call.tool_name.clone(),
        tool_namespace: call.tool_namespace.clone(),
        arguments_hash: sha256_str(&serde_json::to_string(&call.arguments).unwrap_or_default()),
        redacted_arguments_preview: args_preview,
        resources_targeted: call.resources_targeted.clone(),
        resources_modified: call.resources_modified.clone(),
    };

    let chain_of_custody = ChainOfCustody {
        received_timestamp: call.received_timestamp.clone(),
        evaluated_timestamp: evaluated_timestamp.to_string(),
        emitted_timestamp: emitted_timestamp.to_string(),
        processing_node_id: PROCESSING_NODE_ID.to_string(),
        previous_record_hash,
        record_hash: String::new(),
        signature_stub: String::new(),
    };

    EvidenceRecordInternal {
        record_id,
        organization_id: identity.organization_id.clone(),
        environment: identity.environment.clone(),
        agent_id: identity.agent_id.clone(),
        agent_identity_version: identity.identity_version.clone(),
        human_owner_operator: identity.owner.clone(),
        action_allowed,
        standardized_error,
        ingress_envelope,
        action_payload,
        evaluation_ledger: evaluation_ledger.to_vec(),
        chain_of_custody,
    }
}

/// Finalize an evidence record by computing its hash and signature
pub fn finalize_evidence_record(record: &mut EvidenceRecordInternal) {
    // Convert to Value for hashing - use &mut *record to avoid move
    let record_value = serde_json::to_value(&mut *record).expect("Failed to serialize evidence record");

    // Hash the record (excluding chain_of_custody.record_hash and signature_stub)
    let record_hash = hash_evidence_record(&record_value).expect("Failed to hash evidence record");

    let signature_stub = sign_record_stub(&record_hash);

    record.chain_of_custody.record_hash = record_hash;
    record.chain_of_custody.signature_stub = signature_stub;
}

/// Run the complete trace simulation (Rust version of TypeScript runTraceSimulation)
pub fn run_trace_simulation(
    identity: &AgentIdentity,
    policy: &PolicySpecInternal,
    call: &AgentToolCallInternal,
    previous_record_hash: Option<String>,
    evaluated_timestamp: &str,
    emitted_timestamp: &str,
) -> Result<SimulationResultInternal, crate::types::TraceCoreError> {
    // Verify identity
    let identity_ledger = verify_identity(identity, call);

    // Evaluate policy
    let policy_ledger = evaluate_policy(policy, call);

    // Combine ledgers
    let mut evaluation_ledger: Vec<EvaluationLedgerEntry> = identity_ledger
        .into_iter()
        .map(|e| EvaluationLedgerEntry {
            policy_id: e.policy_id,
            policy_version: e.policy_version,
            rule_id: e.rule_id,
            rule_mode: e.rule_mode,
            result: e.result,
            reason: e.reason,
            severity: e.severity,
        })
        .collect();

    evaluation_ledger.extend(policy_ledger.into_iter().map(|e| EvaluationLedgerEntry {
        policy_id: e.policy_id,
        policy_version: e.policy_version,
        rule_id: e.rule_id,
        rule_mode: e.rule_mode,
        result: e.result,
        reason: e.reason,
        severity: e.severity,
    }));

    // Check for blocking entry
    let blocking_entry = evaluation_ledger.iter().find(|e| e.result == "block");
    let action_allowed = blocking_entry.is_none();

    let standardized_error = blocking_entry.map(|entry| StandardizedAgentError {
        code: "TRACE_POLICY_BLOCKED".to_string(),
        message: "Action blocked by Trace policy evaluation.".to_string(),
        rule_id: entry.rule_id.clone(),
    });

    // Build evidence record
    let mut evidence_record = build_evidence_record(
        identity,
        call,
        &evaluation_ledger,
        action_allowed,
        standardized_error.clone(),
        previous_record_hash,
        evaluated_timestamp,
        emitted_timestamp,
    );

    // Finalize with hash and signature
    finalize_evidence_record(&mut evidence_record);

    // Determine mode
    let mode = blocking_entry
        .map(|e| e.rule_mode.clone())
        .unwrap_or_else(|| policy.global_mode.clone());

    Ok(SimulationResultInternal {
        mode,
        action_allowed,
        agent_response: AgentResponse {
            ok: action_allowed,
            request_id: call.request_id.clone(),
            error: standardized_error,
        },
        evidence_record,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::*;
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
            request_id: "ap_12500_payment_draft".to_string(),
            agent_id: "accounts-payable-agent-17".to_string(),
            prompt: "Create a payment draft for Acme Industrial Supplies invoice INV-2026-1188.".to_string(),
            model_provider: "openai".to_string(),
            model_name: "gpt-5".to_string(),
            model_config: {
                let mut map = std::collections::HashMap::new();
                map.insert("temperature".to_string(), json!(0.2));
                map.insert("max_output_tokens".to_string(), json!(1200));
                map.insert("tool_choice".to_string(), json!("required"));
                map
            },
            parent_context: None,
            tool_namespace: "finance.ap".to_string(),
            tool_name: "payment_draft.create".to_string(),
            action: "create".to_string(),
            arguments: {
                let mut map = std::collections::HashMap::new();
                map.insert("invoice_id".to_string(), json!("INV-2026-1188"));
                map.insert("vendor_id".to_string(), json!("vendor_acme_industrial"));
                map.insert("amount_usd".to_string(), json!(12500));
                map.insert("payment_method".to_string(), json!("ach"));
                map.insert("account_number".to_string(), json!("000123456789"));
                map.insert("supervisor_signature".to_string(), json!(null));
                map
            },
            resources_targeted: vec![
                "invoice:INV-2026-1188".to_string(),
                "vendor:vendor_acme_industrial".to_string(),
            ],
            resources_modified: vec!["payment_draft:pending".to_string()],
            network_destination: "api.bank-sandbox.example".to_string(),
            received_timestamp: "2026-06-04T14:00:00.000Z".to_string(),
        }
    }

    fn sample_policy_internal() -> PolicySpecInternal {
        PolicySpecInternal {
            policy_id: "pol_accounts_payable_agentic_controls".to_string(),
            policy_version: "2026-06-04.1".to_string(),
            global_mode: "observe".to_string(),
            rules: vec![PolicyRuleInternal {
                id: "payment-threshold".to_string(),
                description: "Require supervisor signature for payment drafts above 10000 USD.".to_string(),
                rule_mode: Some("enforce".to_string()),
                interrupt: "soft".to_string(),
                severity: "high".to_string(),
                detector: "payment_threshold".to_string(),
                reason: "human supervisor signature required above threshold".to_string(),
                threshold_usd: Some(10000.0),
                forbidden_tools: vec![],
                forbidden_resource_patterns: vec![],
                allowed_destinations: vec![],
            }],
        }
    }

    #[test]
    fn test_run_trace_simulation_allowed() {
        let identity = sample_identity();
        let policy = sample_policy_internal();
        let mut call = sample_call_internal();
        call.arguments.insert("amount_usd".to_string(), json!(5000));

        let result = run_trace_simulation(
            &identity,
            &policy,
            &call,
            None,
            "2026-06-04T14:00:01.000Z",
            "2026-06-04T14:00:02.000Z",
        ).unwrap();

        assert!(result.action_allowed);
        assert_eq!(result.mode, "observe");
        assert!(result.evidence_record.chain_of_custody.record_hash.starts_with("sha256:"));
        assert!(result.evidence_record.chain_of_custody.signature_stub.starts_with("signature_stub:v0:"));
    }

    #[test]
    fn test_run_trace_simulation_blocked() {
        let identity = sample_identity();
        let policy = sample_policy_internal();
        let call = sample_call_internal();

        let result = run_trace_simulation(
            &identity,
            &policy,
            &call,
            None,
            "2026-06-04T14:00:01.000Z",
            "2026-06-04T14:00:02.000Z",
        ).unwrap();

        // In observe mode, action is still allowed but flagged
        assert!(result.action_allowed);
        assert_eq!(result.mode, "observe");
        // The ledger should contain a flag entry
        let flagged = result.evidence_record.evaluation_ledger.iter().find(|e| e.result == "flag");
        assert!(flagged.is_some());
        assert_eq!(flagged.unwrap().rule_id, "payment-threshold");
    }

    #[test]
    fn test_evidence_record_chain_integrity() {
        let identity = sample_identity();
        let policy = sample_policy_internal();
        let call = sample_call_internal();

        let result = run_trace_simulation(
            &identity,
            &policy,
            &call,
            None,
            "2026-06-04T14:00:01.000Z",
            "2026-06-04T14:00:02.000Z",
        ).unwrap();

        // Verify the record hash is consistent
        let record_value = serde_json::to_value(&result.evidence_record).unwrap();
        let mut record_clone = record_value.clone();
        if let Value::Object(ref mut map) = record_clone {
            if let Some(Value::Object(ref mut custody)) = map.get_mut("chain_of_custody") {
                custody.remove("record_hash");
                custody.remove("signature_stub");
            }
        }
        let recomputed_hash = crate::hash::sha256_value(&record_clone);
        assert_eq!(result.evidence_record.chain_of_custody.record_hash, recomputed_hash);
    }
}