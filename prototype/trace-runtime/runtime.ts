import type { AgentIdentity, AgentToolCall, EvaluationLedgerEntry, EvidenceRecord, PolicySpec, SimulationResult, TraceModelResponse } from "./types.js";
import { sha256 } from "./hash.js";
import { evaluatePolicy, verifyIdentity } from "./policy.js";
import { redactedPreview } from "./redact.js";
import { analyzeUsageIntent } from "./usage-intelligence.js";

const PROCESSING_NODE_ID = "trace-local-node-001";

export function runTraceSimulation(input: {
  identity: AgentIdentity;
  policy: PolicySpec;
  call: AgentToolCall;
  previousRecordHash?: string | null;
  emittedTimestamp?: string;
}): SimulationResult {
  const evaluatedTimestamp = input.emittedTimestamp ?? "2026-06-04T14:00:01.000Z";
  const emittedTimestamp = input.emittedTimestamp ?? "2026-06-04T14:00:02.000Z";
  const identityLedger = verifyIdentity(input.identity, input.call);
  const policyLedger = evaluatePolicy(input.policy, input.call);
  const evaluationLedger = [...identityLedger, ...policyLedger];
  const blockingEntry = evaluationLedger.find((entry) => entry.result === "block");
  const actionAllowed = !blockingEntry;
  const standardizedError = blockingEntry
    ? {
        code: "TRACE_POLICY_BLOCKED",
        message: "Action blocked by Trace policy evaluation.",
        rule_id: blockingEntry.rule_id,
      }
    : null;

  const recordWithoutHash: EvidenceRecord = {
    record_id: `ev_${input.call.request_id}`,
    organization_id: input.identity.organization_id,
    environment: input.identity.environment,
    agent_id: input.identity.agent_id,
    agent_identity_version: input.identity.identity_version,
    human_owner_operator: input.identity.owner,
    action_allowed: actionAllowed,
    standardized_error: standardizedError,
    ingress_envelope: {
      prompt_hash: sha256(input.call.prompt),
      model_provider: input.call.model_provider,
      model_name: input.call.model_name,
      model_config_hash: sha256(input.call.model_config),
      parent_context_hash: sha256(input.call.parent_context ?? {}),
    },
    action_payload: {
      tool_name: input.call.tool_name,
      tool_namespace: input.call.tool_namespace,
      arguments_hash: sha256(input.call.arguments),
      redacted_arguments_preview: redactedPreview(input.call.arguments),
      resources_targeted: input.call.resources_targeted,
      resources_modified: input.call.resources_modified,
    },
    evaluation_ledger: evaluationLedger,
    chain_of_custody: {
      received_timestamp: input.call.received_timestamp,
      evaluated_timestamp: evaluatedTimestamp,
      emitted_timestamp: emittedTimestamp,
      processing_node_id: PROCESSING_NODE_ID,
      previous_record_hash: input.previousRecordHash ?? null,
      record_hash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      signature_stub: "pending",
    },
  };

  const record_hash = hashEvidenceRecord(recordWithoutHash);
  const evidence_record: EvidenceRecord = {
    ...recordWithoutHash,
    chain_of_custody: {
      ...recordWithoutHash.chain_of_custody,
      record_hash,
      signature_stub: signRecordStub(record_hash),
    },
  };

  return {
    mode: blockingEntry?.rule_mode ?? input.policy.global_mode,
    action_allowed: actionAllowed,
    agent_response: {
      ok: actionAllowed,
      request_id: input.call.request_id,
      error: standardizedError,
    },
    evidence_record,
  };
}

export function samplePaymentDraftCall(): AgentToolCall {
  return {
    request_id: "ap_12500_payment_draft",
    agent_id: "accounts-payable-agent-17",
    prompt: "Create a payment draft for Acme Industrial Supplies invoice INV-2026-1188.",
    model_provider: "openai",
    model_name: "gpt-5",
    model_config: {
      temperature: 0.2,
      max_output_tokens: 1200,
      tool_choice: "required",
    },
    parent_context: {
      workflow_id: "wf_accounts_payable_daily_close",
      previous_record_hash: null,
    },
    tool_namespace: "finance.ap",
    tool_name: "payment_draft.create",
    action: "create",
    arguments: {
      invoice_id: "INV-2026-1188",
      vendor_id: "vendor_acme_industrial",
      amount_usd: 12500,
      payment_method: "ach",
      account_number: "000123456789",
      supervisor_signature: null,
    },
    resources_targeted: ["invoice:INV-2026-1188", "vendor:vendor_acme_industrial"],
    resources_modified: ["payment_draft:pending"],
    network_destination: "api.bank-sandbox.example",
    received_timestamp: "2026-06-04T14:00:00.000Z",
  };
}

export function sampleGoogleSearchCall(query = "enterprise AI agent audit trail"): AgentToolCall {
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  const intelligence = analyzeUsageIntent(query);

  return {
    request_id: "playground_google_search_test",
    agent_id: "accounts-payable-agent-17",
    prompt: `Search Google for: ${query}`,
    model_provider: "local-playground",
    model_name: "operator-input",
    model_config: {
      source: "trace-local-playground",
      browser_action: true,
    },
    parent_context: {
      page: "trace-local-playground",
      google_url: googleUrl,
    },
    tool_namespace: "browser.web",
    tool_name: "google.search",
    action: "search",
    arguments: {
      query,
      destination_url: googleUrl,
      ...intelligence,
    },
    resources_targeted: ["web_search:google"],
    resources_modified: [],
    network_destination: "www.google.com",
    received_timestamp: "2026-06-06T20:35:00.000Z",
  };
}

export function sampleGoogleSearchResponse(query = "enterprise AI agent audit trail"): TraceModelResponse {
  const intelligence = analyzeUsageIntent(query);

  return {
    content: `AI overview for "${query}": ${intelligence.operator_narrative} Recommended workflow: ${intelligence.recommended_workflow}`,
    model_provider: "google",
    model_name: "gemini-search-overview-simulated",
    finish_reason: "stop",
    input_tokens: Math.max(8, Math.round(query.length / 4)),
    output_tokens: 72,
    created_timestamp: "2026-06-06T20:35:01.000Z",
  };
}

export function withPaymentThresholdMode(policy: PolicySpec, mode: "observe" | "enforce"): PolicySpec {
  return {
    ...policy,
    rules: policy.rules.map((rule) => (rule.id === "payment-threshold" ? { ...rule, mode } : rule)),
  };
}

export function hashEvidenceRecord(record: EvidenceRecord): string {
  return sha256({
    ...record,
    chain_of_custody: {
      ...record.chain_of_custody,
      record_hash: null,
      signature_stub: null,
    },
  });
}

function signRecordStub(recordHash: string): string {
  return `signature_stub:v0:${recordHash}`;
}
