//! Shared types for Trace core - compatible with both Rust and TypeScript via N-API

use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolCapability {
    pub namespace: String,
    pub tool: String,
    pub action: String,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Owner {
    pub name: String,
    pub email: String,
    pub team: String,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ServiceAccountMapping {
    pub provider: String,
    pub subject: String,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AgentIdentity {
    pub identity_version: String,
    pub agent_uuid: String,
    pub agent_id: String,
    pub organization_id: String,
    pub environment: String,
    pub owner: Owner,
    pub service_account_mappings: Vec<ServiceAccountMapping>,
    pub allowed_tool_capabilities: Vec<ToolCapability>,
    pub allowed_network_destinations: Vec<String>,
    pub allowed_resource_scopes: Vec<String>,
    #[serde(default)]
    pub denied_tool_capabilities: Vec<ToolCapability>,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PolicyRule {
    pub id: String,
    pub description: String,
    #[serde(rename = "mode")]
    pub rule_mode: Option<String>,
    pub interrupt: String,
    pub severity: String,
    pub detector: String,
    pub reason: String,
    #[serde(default)]
    pub threshold_usd: Option<f64>,
    #[serde(default)]
    pub forbidden_tools: Vec<ForbiddenTool>,
    #[serde(default)]
    pub forbidden_resource_patterns: Vec<String>,
    #[serde(default)]
    pub allowed_destinations: Vec<String>,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ForbiddenTool {
    pub namespace: String,
    pub tool: String,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PolicySpec {
    pub policy_id: String,
    pub policy_version: String,
    pub global_mode: String,
    pub rules: Vec<PolicyRule>,
}

// Use JSON strings for complex nested types that napi doesn't support directly
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AgentToolCall {
    pub request_id: String,
    pub agent_id: String,
    pub prompt: String,
    pub model_provider: String,
    pub model_name: String,
    pub model_config_json: String,
    pub parent_context_json: Option<String>,
    pub tool_namespace: String,
    pub tool_name: String,
    pub action: String,
    pub arguments_json: String,
    pub resources_targeted: Vec<String>,
    pub resources_modified: Vec<String>,
    pub network_destination: String,
    pub received_timestamp: String,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvaluationLedgerEntry {
    pub policy_id: String,
    pub policy_version: String,
    pub rule_id: String,
    pub rule_mode: String,
    pub result: String,
    pub reason: String,
    pub severity: String,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StandardizedAgentError {
    pub code: String,
    pub message: String,
    pub rule_id: String,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IngressEnvelope {
    pub prompt_hash: String,
    pub model_provider: String,
    pub model_name: String,
    pub model_config_hash: String,
    pub parent_context_hash: String,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionPayload {
    pub tool_name: String,
    pub tool_namespace: String,
    pub arguments_hash: String,
    pub redacted_arguments_preview_json: String,
    pub resources_targeted: Vec<String>,
    pub resources_modified: Vec<String>,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChainOfCustody {
    pub received_timestamp: String,
    pub evaluated_timestamp: String,
    pub emitted_timestamp: String,
    pub processing_node_id: String,
    pub previous_record_hash: Option<String>,
    pub record_hash: String,
    pub signature_stub: String,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvidenceRecord {
    pub record_id: String,
    pub organization_id: String,
    pub environment: String,
    pub agent_id: String,
    pub agent_identity_version: String,
    pub human_owner_operator: Owner,
    pub action_allowed: bool,
    pub standardized_error: Option<StandardizedAgentError>,
    pub ingress_envelope: IngressEnvelope,
    pub action_payload: ActionPayload,
    pub evaluation_ledger: Vec<EvaluationLedgerEntry>,
    pub chain_of_custody: ChainOfCustody,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AgentResponse {
    pub ok: bool,
    pub request_id: String,
    pub error: Option<StandardizedAgentError>,
}

#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SimulationResult {
    pub mode: String,
    pub action_allowed: bool,
    pub agent_response: AgentResponse,
    pub evidence_record: EvidenceRecord,
}

/// Usage Intelligence types
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UsageIntelligence {
    pub llm_usage_detected: bool,
    pub llm_surface: String,
    pub intent_classification: String,
    pub domain_alignment: String,
    pub risk_level: String,
    pub risk_signals: Vec<String>,
    pub operator_narrative: String,
    pub recommended_workflow: String,
}

/// Internal types (not exposed via N-API)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AgentToolCallInternal {
    pub request_id: String,
    pub agent_id: String,
    pub prompt: String,
    pub model_provider: String,
    pub model_name: String,
    pub model_config: HashMap<String, serde_json::Value>,
    pub parent_context: Option<HashMap<String, serde_json::Value>>,
    pub tool_namespace: String,
    pub tool_name: String,
    pub action: String,
    pub arguments: HashMap<String, serde_json::Value>,
    pub resources_targeted: Vec<String>,
    pub resources_modified: Vec<String>,
    pub network_destination: String,
    pub received_timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionPayloadInternal {
    pub tool_name: String,
    pub tool_namespace: String,
    pub arguments_hash: String,
    pub redacted_arguments_preview: serde_json::Value,
    pub resources_targeted: Vec<String>,
    pub resources_modified: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvidenceRecordInternal {
    pub record_id: String,
    pub organization_id: String,
    pub environment: String,
    pub agent_id: String,
    pub agent_identity_version: String,
    pub human_owner_operator: Owner,
    pub action_allowed: bool,
    pub standardized_error: Option<StandardizedAgentError>,
    pub ingress_envelope: IngressEnvelope,
    pub action_payload: ActionPayloadInternal,
    pub evaluation_ledger: Vec<EvaluationLedgerEntry>,
    pub chain_of_custody: ChainOfCustody,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SimulationResultInternal {
    pub mode: String,
    pub action_allowed: bool,
    pub agent_response: AgentResponse,
    pub evidence_record: EvidenceRecordInternal,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PolicyRuleInternal {
    pub id: String,
    pub description: String,
    pub rule_mode: Option<String>,
    pub interrupt: String,
    pub severity: String,
    pub detector: String,
    pub reason: String,
    pub threshold_usd: Option<f64>,
    pub forbidden_tools: Vec<ForbiddenTool>,
    pub forbidden_resource_patterns: Vec<String>,
    pub allowed_destinations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PolicySpecInternal {
    pub policy_id: String,
    pub policy_version: String,
    pub global_mode: String,
    pub rules: Vec<PolicyRuleInternal>,
}

/// Internal evaluation result (matches EvaluationLedgerEntry but for internal use)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuleEvaluationResult {
    pub policy_id: String,
    pub policy_version: String,
    pub rule_id: String,
    pub rule_mode: String,
    pub result: String,
    pub reason: String,
    pub severity: String,
}

/// Internal error types
#[derive(Debug, thiserror::Error)]
pub enum TraceCoreError {
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Hash computation error: {0}")]
    Hash(String),
    #[error("Policy evaluation error: {0}")]
    PolicyEvaluation(String),
    #[error("Usage intelligence error: {0}")]
    UsageIntelligence(String),
    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

impl From<TraceCoreError> for napi::Error {
    fn from(err: TraceCoreError) -> Self {
        napi::Error::new(napi::Status::GenericFailure, err.to_string())
    }
}

/// Conversion helpers
impl AgentToolCall {
    pub fn from_internal(internal: &AgentToolCallInternal) -> Self {
        Self {
            request_id: internal.request_id.clone(),
            agent_id: internal.agent_id.clone(),
            prompt: internal.prompt.clone(),
            model_provider: internal.model_provider.clone(),
            model_name: internal.model_name.clone(),
            model_config_json: serde_json::to_string(&internal.model_config).unwrap_or_else(|_| "{}".to_string()),
            parent_context_json: internal.parent_context.as_ref().map(|v| serde_json::to_string(v).unwrap_or_else(|_| "{}".to_string())),
            tool_namespace: internal.tool_namespace.clone(),
            tool_name: internal.tool_name.clone(),
            action: internal.action.clone(),
            arguments_json: serde_json::to_string(&internal.arguments).unwrap_or_else(|_| "{}".to_string()),
            resources_targeted: internal.resources_targeted.clone(),
            resources_modified: internal.resources_modified.clone(),
            network_destination: internal.network_destination.clone(),
            received_timestamp: internal.received_timestamp.clone(),
        }
    }

    pub fn to_internal(&self) -> Result<AgentToolCallInternal, TraceCoreError> {
        Ok(AgentToolCallInternal {
            request_id: self.request_id.clone(),
            agent_id: self.agent_id.clone(),
            prompt: self.prompt.clone(),
            model_provider: self.model_provider.clone(),
            model_name: self.model_name.clone(),
            model_config: serde_json::from_str(&self.model_config_json)?,
            parent_context: match &self.parent_context_json {
                Some(s) => Some(serde_json::from_str(s)?),
                None => None,
            },
            tool_namespace: self.tool_namespace.clone(),
            tool_name: self.tool_name.clone(),
            action: self.action.clone(),
            arguments: serde_json::from_str(&self.arguments_json)?,
            resources_targeted: self.resources_targeted.clone(),
            resources_modified: self.resources_modified.clone(),
            network_destination: self.network_destination.clone(),
            received_timestamp: self.received_timestamp.clone(),
        })
    }
}

impl PolicySpec {
    pub fn from_internal(internal: &PolicySpecInternal) -> Self {
        Self {
            policy_id: internal.policy_id.clone(),
            policy_version: internal.policy_version.clone(),
            global_mode: internal.global_mode.clone(),
            rules: internal.rules.iter().map(PolicyRule::from_internal).collect(),
        }
    }
}

impl PolicyRule {
    pub fn from_internal(internal: &PolicyRuleInternal) -> Self {
        Self {
            id: internal.id.clone(),
            description: internal.description.clone(),
            rule_mode: internal.rule_mode.clone(),
            interrupt: internal.interrupt.clone(),
            severity: internal.severity.clone(),
            detector: internal.detector.clone(),
            reason: internal.reason.clone(),
            threshold_usd: internal.threshold_usd,
            forbidden_tools: internal.forbidden_tools.clone(),
            forbidden_resource_patterns: internal.forbidden_resource_patterns.clone(),
            allowed_destinations: internal.allowed_destinations.clone(),
        }
    }
}