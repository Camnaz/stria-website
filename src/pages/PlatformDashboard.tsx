import {
  ArrowRight,
  ClipboardCheck,
  Database,
  FileSearch,
  GitBranch,
  Network,
  ShieldCheck,
} from "lucide-react";
import {
  Band,
  Hero,
  ProductCallout,
  SectionHeading,
  ThreeCol,
} from "./components";
import { SystemBackdrop, RecursiveWorkflowVisual, StriaKineticScene } from "../components/visual";
import { InfoBlock, ModeColumn, WorkflowClusterCard } from "../../components/common";
import { PrimitiveRegistry, SandboxPanel, TraceEventTable } from "../../components/data-display";
import { Button } from "../../components/ui";
import { navigate, routes } from "../../utils/navigation";
import { traceEvents, workflowClusters, forgePrimitives } from "../../striaPlatformData";
import { traceEvents, workflowClusters, forgePrimitives } from "../striaPlatformData";
import styles from "./PlatformDashboard.module.css";

export function PlatformDashboard() {
  const navigate = useNavigate();
  const totalCost = traceEvents.reduce((sum, event) => sum + event.cost_estimate, 0);
  const avgLatency = Math.round(traceEvents.reduce((sum, event) => sum + event.latency_ms, 0) / traceEvents.length);
  const failures = traceEvents.filter((event) => event.status === "failed").length;
  const flagged = traceEvents.filter((event) => event.status === "flagged").length;

  return (
    <main className={styles.page}>
      <Hero
        className={styles.hero}
        badge={{
          label: "Stria Systems Platform",
          title: "Trace + Forge",
        }}
        title="One loop. From raw AI usage to verified automation."
        text="Trace watches what people and agents actually do with AI. Forge takes the work that repeats and forges it into tested, deterministic primitives. Every deployment feeds telemetry back into the loop."
        actions={[
          <Button key="trace" variant="primary" onClick={() => navigate(routes.trace)}>
            Explore Trace <ArrowRight size={18} />
          </Button>,
          <Button key="forge" variant="secondary" onClick={() => navigate(routes.forge)}>
            Explore Forge
          </Button>,
        ]}
      >
        <SystemBackdrop />
        <RecursiveWorkflowVisual className={styles.recursiveVisual} />
      </Hero>

      <Band className={styles.band}>
        <SectionHeading eyebrow="PLATFORM FLOW" title="LLM usage becomes verified automation." />
        <ol className={styles.platformChain}>
          {[
            "LLM usage",
            "Trace telemetry",
            "Workflow clustering",
            "Forge recommendation",
            "Code and tests",
            "Sandbox verification",
            "Approved primitive registry",
            "Monitored deployment",
            "Feedback into Trace",
          ].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Band>

      <section className={styles.dashboardGrid}>
        <div className={styles.dashboardPanel}>
          <div className={styles.panelHeading}>
            <span>Trace dashboard</span>
            <strong>Observe, attribute, and audit how your organization uses LLMs.</strong>
          </div>
          <div className={styles.metricRow}>
            <div className={styles.metricTile}>
              <span className={styles.metricLabel}>Events</span>
              <strong className={styles.metricValue}>{traceEvents.length}</strong>
            </div>
            <div className={styles.metricTile}>
              <span className={styles.metricLabel}>Cost</span>
              <strong className={styles.metricValue}>${totalCost.toFixed(2)}</strong>
            </div>
            <div className={styles.metricTile}>
              <span className={styles.metricLabel}>Avg latency</span>
              <strong className={styles.metricValue}>{avgLatency}ms</strong>
            </div>
            <div className={styles.metricTile}>
              <span className={styles.metricLabel}>Flagged / failed</span>
              <strong className={styles.metricValue}>{flagged} / {failures}</strong>
            </div>
          </div>
          <TraceEventTable />
        </div>

        <div className={styles.dashboardPanel}>
          <div className={styles.panelHeading}>
            <span>Forge dashboard</span>
            <strong>Turn repeated AI workflows into verified, optimized execution primitives.</strong>
          </div>
          <div className={styles.clusterList}>
            {workflowClusters.map((cluster) => (
              <WorkflowClusterCard key={cluster.id} cluster={cluster} />
            ))}
          </div>
        </div>
      </section>

      <section className={styles.dashboardGrid}>
        <PrimitiveRegistry />
        <SandboxPanel />
      </section>
    </main>
  );
}