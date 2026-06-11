/**
 * Trace Runtime - Rust-backed implementation
 * 
 * This module provides the same interface as the TypeScript runtime
 * but delegates all CPU-intensive operations to the Rust N-API module.
 */

import { TraceCore } from '@trace/core';
import type { AgentIdentity, PolicySpec, AgentToolCall, SimulationResult, EvaluationLedgerEntry, UsageIntelligence, ToolCapability, PolicyRule, StandardizedAgentError, Owner, ServiceAccountMapping, ActionPayload, IngressEnvelope, ChainOfCustody, EvidenceRecord, AgentResponse } from '@trace/core';

// Re-export types for consumers
export type { AgentIdentity, PolicySpec, AgentToolCall, SimulationResult, EvaluationLedgerEntry, UsageIntelligence, ToolCapability, PolicyRule, StandardizedAgentError, Owner, ServiceAccountMapping, ActionPayload, IngressEnvelope, ChainOfCustody, EvidenceRecord, AgentResponse };

const PROCESSING_NODE_ID = 'trace-local-node-001';

// ============================================================================
// Conversion utilities: prototype snake_case <-> Rust N-API camelCase
// ============================================================================

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function convertKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(convertKeys);
  }
  if (obj && typeof obj === 'object') {
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      converted[toCamelCase(key)] = convertKeys(value);
    }
    return converted;
  }
  return obj;
}

function convertIdentity(proto: Record<string, unknown>): AgentIdentity {
  return convertKeys(proto) as AgentIdentity;
}

function convertPolicy(proto: Record<string, unknown>): PolicySpec {
  const converted = convertKeys(proto) as PolicySpec;
  // Ensure optional array fields exist on all rules
  if (converted.rules) {
    for (const rule of converted.rules) {
      if (!rule.forbiddenTools) rule.forbiddenTools = [];
      if (!rule.forbiddenResourcePatterns) rule.forbiddenResourcePatterns = [];
      if (!rule.allowedDestinations) rule.allowedDestinations = [];
    }
  }
  return converted;
}

function convertToolCall(proto: Record<string, unknown>): Record<string, unknown> {
  return convertKeys(proto);
}

// ============================================================================
// Public API
// ============================================================================

const traceCore = new TraceCore();

/**
 * Run a trace simulation using the Rust backend
 */
export async function runTraceSimulation(input: {
  identity: Record<string, unknown>; // prototype snake_case format
  policy: Record<string, unknown>;   // prototype snake_case format
  call: Record<string, unknown>;     // prototype snake_case format
  previousRecordHash?: string | null;
  emittedTimestamp?: string;
}): Promise<any> {
  return traceCore.simulate({
    identity: convertIdentity(input.identity),
    policy: convertPolicy(input.policy),
    call: convertToolCall(input.call),
    previousRecordHash: input.previousRecordHash,
    emittedTimestamp: input.emittedTimestamp,
    evaluatedTimestamp: input.emittedTimestamp,
  });
}

/**
 * Create a sample payment draft call for testing
 */
export function samplePaymentDraftCall(): Record<string, unknown> {
  return traceCore.createPaymentDraftCall({
    requestId: 'ap_12500_payment_draft',
    agentId: 'accounts-payable-agent-17',
    prompt: 'Create a payment draft for Acme Industrial Supplies invoice INV-2026-1188.',
    modelProvider: 'openai',
    modelName: 'gpt-5',
    modelConfig: {
      temperature: 0.2,
      max_output_tokens: 1200,
      tool_choice: 'required',
    },
    invoiceId: 'INV-2026-1188',
    vendorId: 'vendor_acme_industrial',
    amountUsd: 12500,
    paymentMethod: 'ach',
    accountNumber: '000123456789',
    supervisorSignature: null,
  });
}

/**
 * Create a sample Google search call for testing
 */
export function sampleGoogleSearchCall(query = 'enterprise AI agent audit trail'): Record<string, unknown> {
  return traceCore.createWebSearchCall({
    requestId: 'playground_google_search_test',
    agentId: 'accounts-payable-agent-17',
    query,
  });
}

/**
 * Create a sample Google search response
 */
export function sampleGoogleSearchResponse(query = 'enterprise AI agent audit trail') {
  const intelligence = traceCore.usageIntelAnalyze(query);
  return {
    content: `AI overview for "${query}": ${intelligence.operatorNarrative} Recommended workflow: ${intelligence.recommendedWorkflow}`,
    modelProvider: 'google',
    modelName: 'gemini-search-overview-simulated',
    finishReason: 'stop' as const,
    inputTokens: Math.max(8, Math.round(query.length / 4)),
    outputTokens: 72,
    createdTimestamp: new Date().toISOString(),
  };
}

/**
 * Adjust payment threshold mode for testing
 */
export function withPaymentThresholdMode(policy: PolicySpec, mode: 'observe' | 'enforce'): PolicySpec {
  return {
    ...policy,
    rules: policy.rules.map((rule: Record<string, unknown>) =>
      rule.id === 'payment-threshold' ? { ...rule, ruleMode: mode } : rule
    ),
  };
}

// Re-export load functions
export { loadIdentity, loadPolicy } from './load.js';

// ============================================================================
// Conversion: Rust N-API camelCase -> prototype snake_case
// ============================================================================

export function convertSimulationResult(camel: Record<string, unknown>): any {
  return {
    mode: camel.mode,
    action_allowed: camel.actionAllowed,
    agent_response: {
      ok: camel.agentResponse?.ok,
      request_id: camel.agentResponse?.requestId,
      error: camel.agentResponse?.error,
    },
    evidence_record: {
      record_id: camel.evidenceRecord?.recordId,
      organization_id: camel.evidenceRecord?.organizationId,
      environment: camel.evidenceRecord?.environment,
      agent_id: camel.evidenceRecord?.agentId,
      agent_identity_version: camel.evidenceRecord?.agentIdentityVersion,
      human_owner_operator: camel.evidenceRecord?.humanOwnerOperator,
      action_allowed: camel.evidenceRecord?.actionAllowed,
      standardized_error: camel.evidenceRecord?.standardizedError,
      ingress_envelope: camel.evidenceRecord?.ingressEnvelope ? {
        prompt_hash: camel.evidenceRecord.ingressEnvelope?.promptHash,
        model_provider: camel.evidenceRecord.ingressEnvelope?.modelProvider,
        model_name: camel.evidenceRecord.ingressEnvelope?.modelName,
        model_config_hash: camel.evidenceRecord.ingressEnvelope?.modelConfigHash,
        parent_context_hash: camel.evidenceRecord.ingressEnvelope?.parentContextHash,
      } : undefined,
      action_payload: camel.evidenceRecord?.actionPayload ? {
        tool_name: camel.evidenceRecord.actionPayload?.toolName,
        tool_namespace: camel.evidenceRecord.actionPayload?.toolNamespace,
        arguments_hash: camel.evidenceRecord.actionPayload?.argumentsHash,
        redacted_arguments_preview: typeof camel.evidenceRecord.actionPayload?.redactedArgumentsPreviewJson === 'string'
          ? JSON.parse(camel.evidenceRecord.actionPayload.redactedArgumentsPreviewJson)
          : camel.evidenceRecord.actionPayload?.redactedArgumentsPreviewJson,
        resources_targeted: camel.evidenceRecord.actionPayload?.resourcesTargeted,
        resources_modified: camel.evidenceRecord.actionPayload?.resourcesModified,
      } : undefined,
      evaluation_ledger: camel.evidenceRecord?.evaluationLedger?.map((entry: any) => ({
        policy_id: entry.policyId,
        policy_version: entry.policyVersion,
        rule_id: entry.ruleId,
        rule_mode: entry.ruleMode,
        result: entry.result,
        reason: entry.reason,
        severity: entry.severity,
      })) || [],
      chain_of_custody: camel.evidenceRecord?.chainOfCustody ? {
        received_timestamp: camel.evidenceRecord.chainOfCustody?.receivedTimestamp,
        evaluated_timestamp: camel.evidenceRecord.chainOfCustody?.evaluatedTimestamp,
        emitted_timestamp: camel.evidenceRecord.chainOfCustody?.emittedTimestamp,
        processing_node_id: camel.evidenceRecord.chainOfCustody?.processingNodeId,
        previous_record_hash: camel.evidenceRecord.chainOfCustody?.previousRecordHash,
        record_hash: camel.evidenceRecord.chainOfCustody?.recordHash,
        signature_stub: camel.evidenceRecord.chainOfCustody?.signatureStub,
      } : undefined,
    },
  };
}