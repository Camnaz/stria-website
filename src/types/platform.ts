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

export function scorePrimitive(primitive: ForgePrimitive): number {
  const profile = primitive.performance_profile;
  return Math.round(
    profile.correctness * 35 +
    profile.reliability * 30 +
    profile.cost_reduction * 25 +
    Math.max(0, 10 - profile.latency_ms / 100)
  );
}