import type { Deployment } from "../types/platform";

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