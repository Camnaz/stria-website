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
  SectionHeading,
} from "./components";
import { useNavigate } from "react-router-dom";
import { HeroVisual } from "../components/visual";
import { WorkflowClusterCard } from "../components/common";
import { PrimitiveRegistry, SandboxPanel, TraceEventTable } from "../components/data-display";
import { Button } from "../components/ui";
import { routes } from "../utils/navigation";
import { traceEvents, workflowClusters, forgePrimitives, evaluationRuns } from "../striaPlatformData";
import styles from "./PlatformDashboard.module.css";

export function PlatformDashboard() {
  const navigate = useNavigate();
  const totalCost = traceEvents.reduce((sum: number, event: { cost_estimate: number }) => sum + event.cost_estimate, 0);
  const avgLatency = Math.round(traceEvents.reduce((sum: number, event: { latency_ms: number }) => sum + event.latency_ms, 0) / traceEvents.length);
  const failures = traceEvents.filter((event: { status: string }) => event.status === "failed").length;
  const flagged = traceEvents.filter((event: { status: string }) => event.status === "flagged").length;
  const latestRun = evaluationRuns[evaluationRuns.length - 1];

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
        <HeroVisual variant="platform" />
      </Hero>

      <Band className={styles.band}>
        <SectionHeading eyebrow="PLATFORM FLOW" title="LLM usage becomes verified automation." />
        <div className={styles.platformFlow} aria-label="Platform flow">
          <article>
            <span>01</span>
            <h3>Trace intake</h3>
            <p>LLM usage, tool calls, cost, latency, failures, and policy events become evidence records.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Forge decision</h3>
            <p>Repeated work is clustered, recommended, converted into code and tests, then sandbox verified.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Deployment loop</h3>
            <p>Approved primitives enter the registry, run under monitoring, and feed outcomes back into Trace.</p>
          </article>
        </div>
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
          <TraceEventTable events={traceEvents} />
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
        <SandboxPanel activeRun={evaluationRuns[evaluationRuns.length - 1]} />
      </section>
    </main>
  );
}
