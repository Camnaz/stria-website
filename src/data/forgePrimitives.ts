import type { ForgePrimitive } from "../types/platform";

export const forgePrimitives: ForgePrimitive[] = [
  {
    id: "prim_refund_guarded_response",
    organization_id: "org_stria_demo",
    workflow_cluster_id: "wf_refund_exception",
    name: "guarded_refund_response",
    description:
      "Deterministically gathers policy and ticket history, redacts account fields, and drafts a support response with approval checks.",
    spec: "Input: ticket_id. Output: response_draft, policy_basis, approval_required.",
    source_code:
      "export async function guardedRefundResponse(ticketId) { /* generated primitive stub */ }",
    language: "typescript",
    test_suite: [
      "redacts account identifiers",
      "requires approval above threshold",
      "returns policy basis",
      "handles missing ticket",
    ],
    status: "approved",
    version: "1.2.0",
    performance_profile: {
      correctness: 0.96,
      latency_ms: 410,
      cost_reduction: 0.78,
      reliability: 0.94,
    },
    created_at: "2026-06-08T13:40:00Z",
    updated_at: "2026-06-08T14:06:00Z",
  },
  {
    id: "prim_invoice_variance",
    organization_id: "org_stria_demo",
    workflow_cluster_id: "wf_invoice_variance",
    name: "invoice_variance_summary",
    description:
      "Builds deterministic invoice variance summaries from structured finance records and close-period rules.",
    spec: "Input: close_period, vendor_id. Output: variance_summary, source_records, reviewer_notes.",
    source_code:
      "export async function invoiceVarianceSummary(input) { /* generated primitive stub */ }",
    language: "typescript",
    test_suite: [
      "matches source ledger",
      "bounds output length",
      "includes reviewer notes",
    ],
    status: "testing",
    version: "0.4.0",
    performance_profile: {
      correctness: 0.88,
      latency_ms: 520,
      cost_reduction: 0.62,
      reliability: 0.9,
    },
    created_at: "2026-06-08T13:51:00Z",
    updated_at: "2026-06-08T14:02:00Z",
  },
];