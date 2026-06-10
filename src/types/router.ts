export type Surface =
  | "company"
  | "platform"
  | "trace"
  | "forge"
  | "architecture"
  | "traceDocs"
  | "demo";

export interface RouteMetadata {
  title: string;
  description: string;
}

export const routes: Record<Surface, string> = {
  company: "/",
  platform: "/platform",
  trace: "/trace",
  forge: "/forge",
  architecture: "/architecture",
  traceDocs: "/trace/documentation",
  demo: "/demo",
};

export const routeMetadata: Record<Surface, RouteMetadata> = {
  company: {
    title: "Stria Systems | Trustworthy Infrastructure for Enterprise AI",
    description:
      "Stria Systems builds Trace and Forge: enterprise AI infrastructure for LLM observability, auditability, deterministic execution, and verified automation.",
  },
  platform: {
    title: "Stria Platform | Trace and Forge",
    description:
      "Explore the shared Stria platform flow from LLM usage telemetry to workflow clustering, Forge recommendations, verified primitives, and monitored deployment.",
  },
  trace: {
    title: "Stria Trace | AI Observability and Audit Layer",
    description:
      "Observe, attribute, and audit how your organization uses LLMs with prompt, output, tool-call, cost, latency, failure, and compliance telemetry.",
  },
  forge: {
    title: "Stria Forge | Verified Execution Primitives",
    description:
      "Turn repeated AI workflows into verified, optimized execution primitives with sandboxed tests, scoring, versioning, and deployment metadata.",
  },
  architecture: {
    title: "Architecture | Stria Systems",
    description:
      "Explore the Trace data plane, control plane, and trust plane architecture for accountable AI execution.",
  },
  traceDocs: {
    title: "Trace Developer Docs | Stria Systems",
    description:
      "Run the Trace local prototype, replay agent-event fixtures, post custom actions, and inspect schema-valid AI evidence records.",
  },
  demo: {
    title: "Request Demo | Stria Systems",
    description:
      "Request a Trace demo for enterprise AI workflows that need identity, policy evaluation, evidence records, and operational intelligence.",
  },
};