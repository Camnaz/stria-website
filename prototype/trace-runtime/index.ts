/**
 * Trace Runtime Index - Uses Rust-backed implementation
 * 
 * This module re-exports all the public APIs from the rust-runtime.ts
 * which delegates to the high-performance Rust N-API module.
 */

export {
  type AgentIdentity,
  type PolicySpec,
  type AgentToolCall,
  type SimulationResult,
  type EvaluationLedgerEntry,
  type UsageIntelligence,
  type ToolCapability,
  type PolicyRule,
  type StandardizedAgentError,
  type Owner,
  type ServiceAccountMapping,
  type ActionPayload,
  type IngressEnvelope,
  type ChainOfCustody,
  type EvidenceRecord,
  type AgentResponse,
  runTraceSimulation,
  samplePaymentDraftCall,
  sampleGoogleSearchCall,
  sampleGoogleSearchResponse,
  withPaymentThresholdMode,
  convertSimulationResult,
} from './rust-runtime.js';

export { traceLocalStore } from './store.js';
export { loadIdentity, loadPolicy } from './load.js';
export type { TraceIngestEnvelope, TraceMode } from './types.js';