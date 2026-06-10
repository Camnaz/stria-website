/**
 * Trace Runtime - Rust-backed implementation
 * 
 * This module provides the same interface as the TypeScript runtime
 * but delegates all CPU-intensive operations to the Rust N-API module.
 */

import { TraceCore, type AgentIdentity, type PolicySpec, type AgentToolCall, type SimulationResult } from '@trace/core';

// Re-export types for consumers
export type { AgentIdentity, PolicySpec, AgentToolCall, SimulationResult, EvaluationLedgerEntry, UsageIntelligence, ToolCapability, PolicyRule, StandardizedAgentError, Owner, ServiceAccountMapping, ActionPayload, IngressEnvelope, ChainOfCustody, EvidenceRecord, AgentResponse } from '@trace/core';

const PROCESSING_NODE_ID = 'trace-local-node-001';

const traceCore = new TraceCore();

/**
 * Run a trace simulation using the Rust backend
 */
export async function runTraceSimulation(input: {
  identity: AgentIdentity;
  policy: PolicySpec;
  call: AgentToolCall;
  previousRecordHash?: string | null;
  emittedTimestamp?: string;
}): Promise<SimulationResult> {
  return traceCore.simulate({
    identity: input.identity,
    policy: input.policy,
    call: input.call,
    previousRecordHash: input.previousRecordHash,
    emittedTimestamp: input.emittedTimestamp,
    evaluatedTimestamp: input.emittedTimestamp,
  });
}

/**
 * Create a sample payment draft call for testing
 */
export function samplePaymentDraftCall(): Omit<AgentToolCall, 'modelConfigJson' | 'parentContextJson' | 'argumentsJson'> & {
  modelConfig?: Record<string, any>;
  parentContext?: Record<string, any> | null;
  arguments?: Record<string, any>;
} {
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
export function sampleGoogleSearchCall(query = 'enterprise AI agent audit trail'): Omit<AgentToolCall, 'modelConfigJson' | 'parentContextJson' | 'argumentsJson'> & {
  modelConfig?: Record<string, any>;
  parentContext?: Record<string, any> | null;
  arguments?: Record<string, any>;
} {
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
    rules: policy.rules.map((rule: any) =>
      rule.id === 'payment-threshold' ? { ...rule, mode } : rule
    ),
  };
}