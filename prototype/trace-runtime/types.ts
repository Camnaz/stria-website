export type TraceMode = "observe" | "enforce";
export type RuleResult = "pass" | "flag" | "block";
export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface AgentIdentity {
  identity_version: string;
  agent_uuid: string;
  agent_id: string;
  organization_id: string;
  environment: "development" | "staging" | "production";
  owner: {
    name: string;
    email: string;
    team: string;
  };
  service_account_mappings: Array<{
    provider: string;
    subject: string;
  }>;
  allowed_tool_capabilities: ToolCapability[];
  allowed_network_destinations: string[];
  allowed_resource_scopes: string[];
  denied_tool_capabilities?: ToolCapability[];
}

export interface ToolCapability {
  namespace: string;
  tool: string;
  action: string;
}

export interface PolicySpec {
  policy_id: string;
  policy_version: string;
  global_mode: TraceMode;
  rules: PolicyRule[];
}

export interface PolicyRule {
  id: string;
  description: string;
  mode?: TraceMode;
  interrupt: "soft" | "hard";
  severity: Severity;
  detector:
    | "pii"
    | "token_leakage"
    | "payment_threshold"
    | "tool_forbidden"
    | "resource_delete"
    | "network_allowlist"
    | "managed_ai_usage_review";
  reason: string;
  threshold_usd?: number;
  forbidden_tools?: Array<{
    namespace: string;
    tool: string;
  }>;
  forbidden_resource_patterns?: string[];
  allowed_destinations?: string[];
}

export interface AgentToolCall {
  request_id: string;
  agent_id: string;
  prompt: string;
  model_provider: string;
  model_name: string;
  model_config: Record<string, unknown>;
  parent_context: Record<string, unknown> | null;
  tool_namespace: string;
  tool_name: string;
  action: string;
  arguments: Record<string, unknown>;
  resources_targeted: string[];
  resources_modified: string[];
  network_destination: string;
  received_timestamp: string;
}

export interface EvaluationLedgerEntry {
  policy_id: string;
  policy_version: string;
  rule_id: string;
  rule_mode: TraceMode;
  result: RuleResult;
  reason: string;
  severity: Severity;
}

export interface EvidenceRecord {
  record_id: string;
  organization_id: string;
  environment: "development" | "staging" | "production";
  agent_id: string;
  agent_identity_version: string;
  human_owner_operator: {
    name: string;
    email: string;
    team: string;
  };
  action_allowed: boolean;
  standardized_error: StandardizedAgentError | null;
  ingress_envelope: {
    prompt_hash: string;
    model_provider: string;
    model_name: string;
    model_config_hash: string;
    parent_context_hash: string;
  };
  action_payload: {
    tool_name: string;
    tool_namespace: string;
    arguments_hash: string;
    redacted_arguments_preview: Record<string, unknown>;
    resources_targeted: string[];
    resources_modified: string[];
  };
  evaluation_ledger: EvaluationLedgerEntry[];
  chain_of_custody: {
    received_timestamp: string;
    evaluated_timestamp: string;
    emitted_timestamp: string;
    processing_node_id: string;
    previous_record_hash: string | null;
    record_hash: string;
    signature_stub: string;
  };
}

export interface StandardizedAgentError {
  code: string;
  message: string;
  rule_id: string;
}

export interface SimulationResult {
  mode: TraceMode;
  action_allowed: boolean;
  agent_response: {
    ok: boolean;
    request_id: string;
    error: StandardizedAgentError | null;
  };
  evidence_record: EvidenceRecord;
}

export interface TraceIngestEnvelope {
  tenant_id: string;
  project_id: string;
  user_id: string;
  session_id: string;
  source: "browser_playground" | "agent_runtime" | "api" | "fixture";
  tags?: string[];
  call: AgentToolCall;
  response?: TraceModelResponse;
}

export interface TraceModelResponse {
  content: string;
  model_provider: string;
  model_name: string;
  finish_reason: "stop" | "length" | "tool_call" | "content_filter" | "error";
  input_tokens?: number;
  output_tokens?: number;
  created_timestamp: string;
  redacted_preview?: string;
  response_hash?: string;
}

export interface StoredTraceEvent {
  event_id: string;
  sequence: number;
  tenant_id: string;
  project_id: string;
  user_id: string;
  session_id: string;
  source: TraceIngestEnvelope["source"];
  tags: string[];
  ingested_at: string;
  call: AgentToolCall;
  response: TraceModelResponse | null;
  result: SimulationResult;
}

export interface TraceReplay {
  tenant_id: string;
  project_id: string;
  user_id: string;
  session_id: string;
  event_count: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
  summary: TraceSessionSummary;
  events: StoredTraceEvent[];
}

export interface TraceSessionSummary {
  headline: string;
  narrative: string;
  risk_level: "low" | "medium" | "high" | "none";
  policy_results: Record<RuleResult, number>;
  improvement_opportunities: string[];
}

export interface TraceAnalytics {
  tenant_id: string | null;
  project_id: string | null;
  total_events: number;
  total_sessions: number;
  total_users: number;
  allowed_actions: number;
  blocked_actions: number;
  flagged_events: number;
  llm_usage_events: number;
  response_events: number;
  total_input_tokens: number;
  total_output_tokens: number;
  risk_counts: Record<string, number>;
  intent_counts: Record<string, number>;
  improvement_opportunities: string[];
  top_users: Array<{ user_id: string; events: number }>;
  recent_events: Array<{
    event_id: string;
    session_id: string;
    user_id: string;
    query: string | null;
    intent: string | null;
    risk: string | null;
    response_preview: string | null;
    result: RuleResult;
    record_hash: string;
  }>;
}
