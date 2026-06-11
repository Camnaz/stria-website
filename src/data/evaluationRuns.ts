import type { EvaluationRun } from "../types/platform";

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