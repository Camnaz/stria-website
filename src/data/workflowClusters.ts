import type { WorkflowCluster } from "../types/platform";

export const workflowClusters: WorkflowCluster[] = [
  {
    id: "wf_refund_exception",
    organization_id: "org_stria_demo",
    name: "Refund exception response drafting",
    description:
      "Support users repeatedly ask LLMs to read refund policy, summarize ticket history, and draft a response.",
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
    description:
      "Finance repeatedly summarizes invoice deltas for monthly close with predictable inputs and review rules.",
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
    description:
      "Sales users ask for account risk summaries but tool writeback failures create repeated operational friction.",
    trace_event_ids: ["trc_1005"],
    frequency: 58,
    avg_cost: 0.089,
    avg_latency: 3820,
    failure_rate: 0.29,
    automation_score: 73,
    recommended_for_forge: true,
  },
];