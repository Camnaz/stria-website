export type TraceEvent = {
  id: string;
  organization_id: string;
  user_id: string;
  app_id: string;
  model: string;
  prompt: string;
  output: string;
  tool_calls: string[];
  latency_ms: number;
  cost_estimate: number;
  status: "success" | "failed" | "flagged";
  error_type: string | null;
  created_at: string;
};

export type WorkflowCluster = {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  trace_event_ids: string[];
  frequency: number;
  avg_cost: number;
  avg_latency: number;
  failure_rate: number;
  automation_score: number;
  recommended_for_forge: boolean;
};

export type ForgePrimitive = {
  id: string;
  organization_id: string;
  workflow_cluster_id: string;
  name: string;
  description: string;
  spec: string;
  source_code: string;
  language: "typescript" | "python";
  test_suite: string[];
  status: "candidate" | "testing" | "approved" | "deployed";
  version: string;
  performance_profile: {
    correctness: number;
    latency_ms: number;
    cost_reduction: number;
    reliability: number;
  };
  created_at: string;
  updated_at: string;
};

export type EvaluationRun = {
  id: string;
  primitive_id: string;
  status: "passed" | "failed" | "running";
  tests_passed: number;
  tests_failed: number;
  latency_ms: number;
  memory_mb: number;
  reward_score: number;
  logs: string[];
  created_at: string;
};

export type Deployment = {
  id: string;
  primitive_id: string;
  environment: "sandbox" | "staging" | "production";
  status: "pending" | "active" | "paused" | "rolled_back";
  endpoint_url: string;
  rollback_version: string;
  created_at: string;
};

export const traceEvents: TraceEvent[] = [
  {
    id: "trc_1001",
    organization_id: "org_stria_demo",
    user_id: "support_014",
    app_id: "support-copilot",
    model: "gpt-4.1-mini",
    prompt: "Summarize refund exception history and draft a response.",
    output: "Drafted response with policy caveats and escalation note.",
    tool_calls: ["zendesk.ticket.read", "policy.refund.lookup"],
    latency_ms: 1480,
    cost_estimate: 0.043,
    status: "success",
    error_type: null,
    created_at: "2026-06-08T13:04:00Z",
  },
  {
    id: "trc_1002",
    organization_id: "org_stria_demo",
    user_id: "support_022",
    app_id: "support-copilot",
    model: "claude-3-5-haiku",
    prompt: "Can I paste customer account numbers so the answer is more specific?",
    output: "Refused sensitive account handling and suggested redacted identifiers.",
    tool_calls: ["trace.policy.evaluate"],
    latency_ms: 890,
    cost_estimate: 0.018,
    status: "flagged",
    error_type: "sensitive_data",
    created_at: "2026-06-08T13:11:00Z",
  },
  {
    id: "trc_1003",
    organization_id: "org_stria_demo",
    user_id: "ops_007",
    app_id: "finance-agent",
    model: "gemini-2.5-flash",
    prompt: "Create an invoice variance explanation for monthly close.",
    output: "Generated variance summary after reading invoice records.",
    tool_calls: ["netsuite.invoice.search", "finance.close.summarize"],
    latency_ms: 2310,
    cost_estimate: 0.067,
    status: "success",
    error_type: null,
    created_at: "2026-06-08T13:17:00Z",
  },
  {
    id: "trc_1004",
    organization_id: "org_stria_demo",
    user_id: "support_014",
    app_id: "support-copilot",
    model: "gpt-4.1-mini",
    prompt: "Bypass the refund approval step for low value cases.",
    output: "Refused approval bypass and routed to manager review.",
    tool_calls: ["trace.policy.evaluate", "workflow.review.create"],
    latency_ms: 1040,
    cost_estimate: 0.025,
    status: "flagged",
    error_type: "approval_bypass",
    created_at: "2026-06-08T13:24:00Z",
  },
  {
    id: "trc_1005",
    organization_id: "org_stria_demo",
    user_id: "sales_031",
    app_id: "revenue-copilot",
    model: "gpt-4.1-mini",
    prompt: "Summarize renewal risks and next best action for this account.",
    output: "Produced renewal risk summary but failed CRM writeback.",
    tool_calls: ["salesforce.account.read", "salesforce.note.create"],
    latency_ms: 3820,
    cost_estimate: 0.089,
    status: "failed",
    error_type: "tool_write_failed",
    created_at: "2026-06-08T13:35:00Z",
  },
];

export const workflowClusters: WorkflowCluster[] = [
  {
    id: "wf_refund_exception",
    organization_id: "org_stria_demo",
    name: "Refund exception response drafting",
    description: "Support users repeatedly ask LLMs to read refund policy, summarize ticket history, and draft a response.",
    trace_event_ids: ["trc_1001", "trc_1002", "trc_1004"],
    frequency: 184,
    avg_cost: 0.036,
    avg_latency: 1220,
    failure_rate: 0.11,
    automation_score: 91,
    recommended_for_forge: true,
  },
  {
    id: "wf_invoice_variance",
    organization_id: "org_stria_demo",
    name: "Invoice variance explanation",
    description: "Finance repeatedly summarizes invoice deltas for monthly close with predictable inputs and review rules.",
    trace_event_ids: ["trc_1003"],
    frequency: 76,
    avg_cost: 0.067,
    avg_latency: 2310,
    failure_rate: 0.04,
    automation_score: 84,
    recommended_for_forge: true,
  },
  {
    id: "wf_renewal_risk",
    organization_id: "org_stria_demo",
    name: "Renewal risk summary",
    description: "Sales users ask for account risk summaries but tool writeback failures create repeated operational friction.",
    trace_event_ids: ["trc_1005"],
    frequency: 58,
    avg_cost: 0.089,
    avg_latency: 3820,
    failure_rate: 0.29,
    automation_score: 73,
    recommended_for_forge: true,
  },
];

export const forgePrimitives: ForgePrimitive[] = [
  {
    id: "prim_refund_guarded_response",
    organization_id: "org_stria_demo",
    workflow_cluster_id: "wf_refund_exception",
    name: "guarded_refund_response",
    description: "Deterministically gathers policy and ticket history, redacts account fields, and drafts a support response with approval checks.",
    spec: "Input: ticket_id. Output: response_draft, policy_basis, approval_required.",
    source_code: "export async function guardedRefundResponse(ticketId) { /* generated primitive stub */ }",
    language: "typescript",
    test_suite: ["redacts account identifiers", "requires approval above threshold", "returns policy basis", "handles missing ticket"],
    status: "approved",
    version: "1.2.0",
    performance_profile: { correctness: 0.96, latency_ms: 410, cost_reduction: 0.78, reliability: 0.94 },
    created_at: "2026-06-08T13:40:00Z",
    updated_at: "2026-06-08T14:06:00Z",
  },
  {
    id: "prim_invoice_variance",
    organization_id: "org_stria_demo",
    workflow_cluster_id: "wf_invoice_variance",
    name: "invoice_variance_summary",
    description: "Builds deterministic invoice variance summaries from structured finance records and close-period rules.",
    spec: "Input: close_period, vendor_id. Output: variance_summary, source_records, reviewer_notes.",
    source_code: "export async function invoiceVarianceSummary(input) { /* generated primitive stub */ }",
    language: "typescript",
    test_suite: ["matches source ledger", "bounds output length", "includes reviewer notes"],
    status: "testing",
    version: "0.4.0",
    performance_profile: { correctness: 0.88, latency_ms: 520, cost_reduction: 0.62, reliability: 0.9 },
    created_at: "2026-06-08T13:51:00Z",
    updated_at: "2026-06-08T14:02:00Z",
  },
];

export const evaluationRuns: EvaluationRun[] = [
  {
    id: "eval_9001",
    primitive_id: "prim_refund_guarded_response",
    status: "passed",
    tests_passed: 42,
    tests_failed: 0,
    latency_ms: 410,
    memory_mb: 92,
    reward_score: 94,
    logs: ["redaction pass", "approval gate pass", "policy basis pass"],
    created_at: "2026-06-08T14:06:00Z",
  },
  {
    id: "eval_9002",
    primitive_id: "prim_invoice_variance",
    status: "running",
    tests_passed: 28,
    tests_failed: 2,
    latency_ms: 520,
    memory_mb: 108,
    reward_score: 81,
    logs: ["ledger match pass", "missing reviewer note on edge case"],
    created_at: "2026-06-08T14:09:00Z",
  },
];

export const deployments: Deployment[] = [
  {
    id: "dep_7001",
    primitive_id: "prim_refund_guarded_response",
    environment: "staging",
    status: "active",
    endpoint_url: "https://staging.stria.local/primitives/guarded_refund_response",
    rollback_version: "1.1.0",
    created_at: "2026-06-08T14:11:00Z",
  },
];

export function scorePrimitive(primitive: ForgePrimitive) {
  const profile = primitive.performance_profile;
  return Math.round(profile.correctness * 35 + profile.reliability * 30 + profile.cost_reduction * 25 + Math.max(0, 10 - profile.latency_ms / 100));
}
