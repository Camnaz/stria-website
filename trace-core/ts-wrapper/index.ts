/**
 * Trace Core - TypeScript wrapper for the Rust native module
 * 
 * Provides a type-safe interface to the high-performance Rust implementation
 * of Trace's core policy evaluation, hashing, and usage intelligence.
 */

import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';

// ============================================================================
// Types (matching Rust N-API exports)
// ============================================================================

export interface ToolCapability {
  namespace: string;
  tool: string;
  action: string;
}

export interface Owner {
  name: string;
  email: string;
  team: string;
}

export interface ServiceAccountMapping {
  provider: string;
  subject: string;
}

export interface AgentIdentity {
  identityVersion: string;
  agentUuid: string;
  agentId: string;
  organizationId: string;
  environment: 'development' | 'staging' | 'production';
  owner: Owner;
  serviceAccountMappings: ServiceAccountMapping[];
  allowedToolCapabilities: ToolCapability[];
  allowedNetworkDestinations: string[];
  allowedResourceScopes: string[];
  deniedToolCapabilities?: ToolCapability[];
}

export interface PolicyRule {
  id: string;
  description: string;
  mode?: 'observe' | 'enforce';
  interrupt: 'soft' | 'hard';
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  detector: string;
  reason: string;
  thresholdUsd?: number;
  forbiddenTools?: ToolCapability[];
  forbiddenResourcePatterns?: string[];
  allowedDestinations?: string[];
}

export interface PolicySpec {
  policyId: string;
  policyVersion: string;
  globalMode: 'observe' | 'enforce';
  rules: PolicyRule[];
}

export interface AgentToolCall {
  requestId: string;
  agentId: string;
  prompt: string;
  modelProvider: string;
  modelName: string;
  modelConfigJson: string;
  parentContextJson?: string | null;
  toolNamespace: string;
  toolName: string;
  action: string;
  argumentsJson: string;
  resourcesTargeted: string[];
  resourcesModified: string[];
  networkDestination: string;
  receivedTimestamp: string;
}

export interface EvaluationLedgerEntry {
  policyId: string;
  policyVersion: string;
  ruleId: string;
  ruleMode: string;
  result: 'pass' | 'flag' | 'block';
  reason: string;
  severity: string;
}

export interface StandardizedAgentError {
  code: string;
  message: string;
  ruleId: string;
}

export interface IngressEnvelope {
  promptHash: string;
  modelProvider: string;
  modelName: string;
  modelConfigHash: string;
  parentContextHash: string;
}

export interface ActionPayload {
  toolName: string;
  toolNamespace: string;
  argumentsHash: string;
  redactedArgumentsPreviewJson: string;
  resourcesTargeted: string[];
  resourcesModified: string[];
}

export interface ChainOfCustody {
  receivedTimestamp: string;
  evaluatedTimestamp: string;
  emittedTimestamp: string;
  processingNodeId: string;
  previousRecordHash?: string | null;
  recordHash: string;
  signatureStub: string;
}

export interface EvidenceRecord {
  recordId: string;
  organizationId: string;
  environment: string;
  agentId: string;
  agentIdentityVersion: string;
  humanOwnerOperator: Owner;
  actionAllowed: boolean;
  standardizedError: StandardizedAgentError | null;
  ingressEnvelope: IngressEnvelope;
  actionPayload: ActionPayload;
  evaluationLedger: EvaluationLedgerEntry[];
  chainOfCustody: ChainOfCustody;
}

export interface AgentResponse {
  ok: boolean;
  requestId: string;
  error: StandardizedAgentError | null;
}

export interface SimulationResult {
  mode: string;
  actionAllowed: boolean;
  agentResponse: AgentResponse;
  evidenceRecord: EvidenceRecord;
}

export interface UsageIntelligence {
  llmUsageDetected: boolean;
  llmSurface: string;
  intentClassification: string;
  domainAlignment: 'in_domain' | 'adjacent' | 'out_of_domain';
  riskLevel: 'low' | 'medium' | 'high';
  riskSignals: string[];
  operatorNarrative: string;
  recommendedWorkflow: string;
}

// ============================================================================
// Native Module Loader
// ============================================================================

let nativeModule: any = null;

function getProjectRoot(): string {
  // Try to resolve from various entry points
  try {
    // If loaded as a module, use its package.json location
    const modulePath = require.resolve('@trace/core/package.json');
    return path.dirname(modulePath);
  } catch {
    // Fallback: try to find the trace-core directory from known locations
    const knownRoots = [
      process.cwd(),
      path.join(__dirname, '..', '..'),
      path.join(__dirname, '..'),
      path.join('/Users/cnazarko/stria systems/TraceV2'),
      '/Users/cnazarko/stria systems/TraceV2',
    ];
    
    for (const root of knownRoots) {
      const traceCorePath = path.join(root, 'trace-core');
      const nodePath = path.join(traceCorePath, 'trace_core.darwin-arm64.node');
      if (fsSync.existsSync(nodePath)) {
        return traceCorePath;
      }
    }
    
    return process.cwd();
  }
}

function loadNativeModule(): any {
  if (nativeModule) return nativeModule;

  const projectRoot = getProjectRoot();
  
  // Try multiple possible locations for the native module
  const possiblePaths = [
    // Local development - check current directory first (for ts-wrapper/dist)
    path.join(__dirname, 'trace_core.darwin-arm64.node'),
    path.join(__dirname, `trace_core.${process.platform}-${process.arch}.node`),
    // Local development - from project root
    path.join(projectRoot, 'trace_core.darwin-arm64.node'),
    path.join(projectRoot, `trace_core.${process.platform}-${process.arch}.node`),
    // NPM package style
    path.join(projectRoot, 'node_modules', '@trace', 'core', 'trace_core.darwin-arm64.node'),
    // Relative to this file (for dist builds) - trace-core directory
    path.join(__dirname, '..', 'trace-core', 'trace_core.darwin-arm64.node'),
    path.join(__dirname, '..', 'trace-core', `trace_core.${process.platform}-${process.arch}.node`),
    // Relative to this file - trace-core root
    path.join(__dirname, '..', '..', 'trace_core.darwin-arm64.node'),
    path.join(__dirname, '..', '..', `trace_core.${process.platform}-${process.arch}.node`),
  ];

  for (const p of possiblePaths) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      nativeModule = require(p);
      console.log(`[trace-core] Loaded native module from: ${p}`);
      return nativeModule;
    } catch {
      // Continue to next path
    }
  }

  throw new Error(
    'trace-core native module not found. Run `npm run build` in trace-core directory first.'
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function convertKeysToSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToSnakeCase);
  }
  if (obj && typeof obj === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[toSnakeCase(key)] = convertKeysToSnakeCase(value);
    }
    return converted;
  }
  return obj;
}

function prepareArgumentsJson(args: Record<string, any>): string {
  // Convert camelCase keys to snake_case for Rust internal processing
  const snakeArgs = convertKeysToSnakeCase(args);
  return JSON.stringify(snakeArgs);
}

function prepareModelConfig(config: Record<string, any>): string {
  return JSON.stringify(convertKeysToSnakeCase(config));
}

// ============================================================================
// TraceCore Client Class
// ============================================================================

export class TraceCore {
  private native: any;

  constructor() {
    this.native = loadNativeModule();
  }

  // ---- Canonical JSON ----

  canonicalJsonSort(value: any): string {
    return this.native.canonicalJsonSort(JSON.stringify(value));
  }

  canonicalJsonSerialize(value: any): string {
    return this.native.canonicalJsonSerialize(JSON.stringify(value));
  }

  // ---- Hashing ----

  hashSha256Str(input: string): string {
    return this.native.hashSha256Str(input);
  }

  hashSha256Value(value: any): string {
    return this.native.hashSha256Value(JSON.stringify(value));
  }

  hashSha256Any(value: any): string {
    return this.native.hashSha256Any(JSON.stringify(value));
  }

  hashEvidenceRecord(record: any): string {
    return this.native.hashEvidenceRecordNapi(JSON.stringify(record));
  }

  hashSignRecordStub(recordHash: string): string {
    return this.native.hashSignRecordStub(recordHash);
  }

  // ---- Policy Evaluation ----

  policyVerifyIdentity(identity: AgentIdentity, call: AgentToolCall): EvaluationLedgerEntry[] {
    return this.native.policyVerifyIdentity(identity, call);
  }

  policyEvaluate(policy: PolicySpec, call: AgentToolCall): EvaluationLedgerEntry[] {
    return this.native.policyEvaluate(policy, call);
  }

  // ---- Redaction ----

  redactArguments(args: Record<string, any>): string {
    return this.native.redactArguments(JSON.stringify(args));
  }

  // ---- Usage Intelligence ----

  usageIntelAnalyze(query: string): UsageIntelligence {
    return this.native.usageIntelAnalyze(query);
  }

  // ---- Full Simulation ----

  traceSimulate(
    identity: AgentIdentity,
    policy: PolicySpec,
    call: AgentToolCall,
    previousRecordHash: string | null,
    evaluatedTimestamp: string,
    emittedTimestamp: string
  ): SimulationResult {
    return this.native.traceSimulate(
      identity,
      policy,
      call,
      previousRecordHash,
      evaluatedTimestamp,
      emittedTimestamp
    );
  }

  // ---- Convenience Methods ----

  /**
   * Run a complete trace simulation with automatic JSON preparation
   */
  async simulate(params: {
    identity: AgentIdentity;
    policy: PolicySpec;
    call: Omit<AgentToolCall, 'modelConfigJson' | 'parentContextJson' | 'argumentsJson'> & {
      modelConfig?: Record<string, any>;
      parentContext?: Record<string, any> | null;
      arguments?: Record<string, any>;
    };
    previousRecordHash?: string | null;
    evaluatedTimestamp?: string;
    emittedTimestamp?: string;
  }): Promise<SimulationResult> {
    const evaluatedTimestamp = params.evaluatedTimestamp ?? new Date().toISOString();
    const emittedTimestamp = params.emittedTimestamp ?? new Date().toISOString();

    const call: AgentToolCall = {
      ...params.call,
      modelConfigJson: params.call.modelConfig
        ? prepareModelConfig(params.call.modelConfig)
        : '{}',
      parentContextJson: params.call.parentContext
        ? prepareArgumentsJson(params.call.parentContext)
        : '{}',
      argumentsJson: params.call.arguments
        ? prepareArgumentsJson(params.call.arguments)
        : '{}',
    };

    return this.traceSimulate(
      params.identity,
      params.policy,
      call,
      params.previousRecordHash ?? null,
      evaluatedTimestamp,
      emittedTimestamp
    );
  }

  /**
   * Create a payment draft call from structured data
   */
  createPaymentDraftCall(params: {
    requestId: string;
    agentId: string;
    prompt: string;
    modelProvider: string;
    modelName: string;
    modelConfig?: Record<string, any>;
    invoiceId: string;
    vendorId: string;
    amountUsd: number;
    paymentMethod: string;
    accountNumber: string;
    supervisorSignature?: string | null;
    resourcesTargeted?: string[];
    resourcesModified?: string[];
    networkDestination?: string;
    receivedTimestamp?: string;
  }): Omit<AgentToolCall, 'modelConfigJson' | 'parentContextJson' | 'argumentsJson'> & {
    modelConfig?: Record<string, any>;
    parentContext?: Record<string, any> | null;
    arguments?: Record<string, any>;
  } {
    return {
      requestId: params.requestId,
      agentId: params.agentId,
      prompt: params.prompt,
      modelProvider: params.modelProvider,
      modelName: params.modelName,
      modelConfig: params.modelConfig,
      parentContext: null,
      toolNamespace: 'finance.ap',
      toolName: 'payment_draft.create',
      action: 'create',
      arguments: {
        invoice_id: params.invoiceId,
        vendor_id: params.vendorId,
        amount_usd: params.amountUsd,
        payment_method: params.paymentMethod,
        account_number: params.accountNumber,
        supervisor_signature: params.supervisorSignature ?? null,
      },
      resourcesTargeted: params.resourcesTargeted ?? [
        `invoice:${params.invoiceId}`,
        `vendor:${params.vendorId}`,
      ],
      resourcesModified: params.resourcesModified ?? ['payment_draft:pending'],
      networkDestination: params.networkDestination ?? 'api.bank-sandbox.example',
      receivedTimestamp: params.receivedTimestamp ?? new Date().toISOString(),
    };
  }

  /**
   * Create a web search call from query
   */
  createWebSearchCall(params: {
    requestId: string;
    agentId: string;
    query: string;
    modelProvider?: string;
    modelName?: string;
    modelConfig?: Record<string, any>;
    riskLevel?: 'low' | 'medium' | 'high';
    domainAlignment?: 'in_domain' | 'adjacent' | 'out_of_domain';
    resourcesTargeted?: string[];
    networkDestination?: string;
    receivedTimestamp?: string;
  }): Omit<AgentToolCall, 'modelConfigJson' | 'parentContextJson' | 'argumentsJson'> & {
    modelConfig?: Record<string, any>;
    parentContext?: Record<string, any> | null;
    arguments?: Record<string, any>;
  } {
    return {
      requestId: params.requestId,
      agentId: params.agentId,
      prompt: `Search Google for: ${params.query}`,
      modelProvider: params.modelProvider ?? 'local-playground',
      modelName: params.modelName ?? 'operator-input',
      modelConfig: params.modelConfig,
      parentContext: { page: 'trace-local-playground', google_url: `https://www.google.com/search?q=${encodeURIComponent(params.query)}` },
      toolNamespace: 'browser.web',
      toolName: 'google.search',
      action: 'search',
      arguments: {
        query: params.query,
        destination_url: `https://www.google.com/search?q=${encodeURIComponent(params.query)}`,
        risk_level: params.riskLevel ?? 'low',
        domain_alignment: params.domainAlignment ?? 'adjacent',
      },
      resourcesTargeted: params.resourcesTargeted ?? ['web_search:google'],
      resourcesModified: [],
      networkDestination: params.networkDestination ?? 'www.google.com',
      receivedTimestamp: params.receivedTimestamp ?? new Date().toISOString(),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let traceCoreInstance: TraceCore | null = null;

export function getTraceCore(): TraceCore {
  if (!traceCoreInstance) {
    traceCoreInstance = new TraceCore();
  }
  return traceCoreInstance;
}

export function resetTraceCore(): void {
  traceCoreInstance = null;
}

// ============================================================================
// High-level Convenience Functions
// ============================================================================

export async function runTraceSimulation(params: {
  identity: AgentIdentity;
  policy: PolicySpec;
  call: Omit<AgentToolCall, 'modelConfigJson' | 'parentContextJson' | 'argumentsJson'> & {
    modelConfig?: Record<string, any>;
    parentContext?: Record<string, any> | null;
    arguments?: Record<string, any>;
  };
  previousRecordHash?: string | null;
  evaluatedTimestamp?: string;
  emittedTimestamp?: string;
}): Promise<SimulationResult> {
  const core = getTraceCore();
  return core.simulate(params);
}

export async function analyzeUsageIntent(query: string): Promise<UsageIntelligence> {
  const core = getTraceCore();
  return core.usageIntelAnalyze(query);
}

export function hashSha256(input: string): string {
  const core = getTraceCore();
  return core.hashSha256Str(input);
}

export function redact(args: Record<string, any>): Record<string, any> {
  const core = getTraceCore();
  return JSON.parse(core.redactArguments(args));
}

export function canonicalJson(value: any): string {
  const core = getTraceCore();
  return core.canonicalJsonSort(value);
}