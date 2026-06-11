import { ArrowRight, Database, FileSearch, GitBranch, LockKeyhole, Network, ShieldCheck } from "lucide-react";
import { Band, ClosingCTA, Hero, SectionHeading, ThreeCol } from "./components";
import { SystemBackdrop } from "../components/visual";
import { ArchitectureCard, InfoBlock } from "../components/common";
import { Button } from "../components/ui";
import { routes } from "../utils/navigation";
import { useNavigate } from "react-router-dom";
import styles from "./ArchitectureOverview.module.css";

export function ArchitectureOverview() {
  const navigate = useNavigate();
  return (
    <main className={styles.page}>
      <Hero
        className={styles.hero}
        badge={{
          label: "Data Plane × Control Plane × Trust Plane",
          title: "Architecture",
        }}
        title="One platform layer for observable and verified AI execution."
        text="Stria separates telemetry ingestion, workflow orchestration, and trust enforcement into three planes — deployable together or independently."
        actions={[
          <Button key="docs" variant="primary" onClick={() => navigate(routes.traceDocs)}>
            View developer docs <ArrowRight size={18} />
          </Button>,
          <Button key="trace" variant="secondary" onClick={() => navigate(routes.trace)}>
            Back to Trace
          </Button>,
        ]}
      >
        <SystemBackdrop />
      </Hero>

      <Band className={styles.band}>
        <SectionHeading eyebrow="DESIGN PRINCIPLES" title="Designed for data sovereignty and auditability." />
        <p className={styles.bandText}>
          The data plane runs in your VPC. The control plane can be managed or self-hosted.
          The trust plane ensures every action is attributable. No vendor lock-in on your evidence.
        </p>
        <ThreeCol>
          <ArchitectureCard
            title="Data Plane"
            items={[
              "Self-hosted inside customer VPC",
              "Telemetry ingestion & storage",
              "Policy evaluation at runtime",
              "Evidence record persistence",
            ]}
          />
          <ArchitectureCard
            title="Control Plane"
            items={[
              "Managed control plane option later",
              "Workflow clustering & scoring",
              "Primitive registry & versioning",
              "Deployment orchestration",
            ]}
          />
          <ArchitectureCard
            title="Trust Plane"
            items={[
              "Designed for data sovereignty",
              "Local-first prototype today",
              "Audit-ready evidence export",
              "Identity & authority management",
            ]}
          />
        </ThreeCol>
      </Band>

      <Band className={styles.band}>
        <SectionHeading eyebrow="ARCHITECTURE DEPTH" title="Three planes, one consistent evidence trail." />
        <ThreeCol>
          <InfoBlock
            icon={<Network />}
            title="Data Plane"
            text="Ingests agent events via REST. Evaluates policy against identity manifests. Emits tamper-evident evidence records with cryptographic hash chaining. SQLite today; Postgres in production."
          />
          <InfoBlock
            icon={<GitBranch />}
            title="Control Plane"
            text="Clusters repeated workflows from telemetry. Scores automation readiness. Generates primitive specifications. Runs sandbox evaluations. Manages deployment lifecycle with rollback."
          />
          <InfoBlock
            icon={<LockKeyhole />}
            title="Trust Plane"
            text="Identity manifests bind agents to policy posture. Authority specs declare permissions with conditions. Evidence records survive audit scrutiny. Export for compliance without vendor dependency."
          />
        </ThreeCol>
      </Band>

      <ClosingCTA
        eyebrow="OBSERVABLE. VERIFIED. ACCOUNTABLE."
        title="Telemetry stays observable. Automation becomes verified."
        text="The Stria platform gives enterprises the evidence layer they need to operate AI at scale — with full attribution, policy enforcement, and audit readiness."
        action={
          <Button variant="primary" onClick={() => navigate(routes.traceDocs)}>
            View developer docs <ArrowRight size={18} />
          </Button>
        }
      />
    </main>
  );
}