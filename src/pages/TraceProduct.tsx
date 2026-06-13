import { ArrowRight, ClipboardCheck, FileSearch, Fingerprint, GitBranch, LockKeyhole, Network, ScanLine, ShieldCheck } from "lucide-react";
import { Band, Hero, ProductCallout, SectionHeading, ThreeCol } from "./components";
import { HeroVisual } from "../components/visual";
import { InfoBlock, ModeColumn, PrimitiveCard, ValueCard } from "../components/common";
import { Button } from "../components/ui";
import { useNavigate } from "react-router-dom";
import { routes } from "../utils/navigation";
import styles from "./TraceProduct.module.css";

export function TraceProduct() {
  const navigate = useNavigate();
  return (
    <main className={styles.page}>
      <Hero
        className={styles.hero}
        badge={{
          label: "Usage intelligence → Evidence → Governance",
          title: "Trace by Stria Systems",
        }}
        title="See every AI action. Prove every AI decision."
        text="Trace captures prompts, outputs, tool calls, user behavior, latency, cost, failure modes, and compliance-relevant events so operators can understand AI usage before they automate or enforce."
        actions={[
          <Button key="docs" variant="primary" onClick={() => navigate(routes.traceDocs)}>
            View developer prototype <ArrowRight size={18} />
          </Button>,
          <Button key="schema" variant="secondary" onClick={() => navigate(routes.traceDocs)}>
            Read the evidence schema
          </Button>,
        ]}
      >
        <HeroVisual variant="trace" />
      </Hero>

      <Band className={styles.band}>
        <SectionHeading eyebrow="TRACE CUSTOMER VALUE" title="Every AI action becomes attributable." />
        <ThreeCol>
          <ValueCard
            icon={<Fingerprint />}
            title="Identity"
            text="Every agent and human gets a verifiable identity manifest tied to policy posture."
          />
          <ValueCard
            icon={<LockKeyhole />}
            title="Authority"
            text="Policy posture specs define what each identity can do, with conditions and approvals."
          />
          <ValueCard
            icon={<ScanLine />}
            title="Evidence"
            text="Tamper-evident evidence records capture every action with cryptographic integrity."
          />
        </ThreeCol>
      </Band>

      <Band className={styles.band}>
        <SectionHeading eyebrow="CORE PRIMITIVES" title="The three primitives behind accountable AI execution." />
        <ThreeCol>
          <PrimitiveCard
            title="Identity Manifests"
            items={[
              "Agent identity binding",
              "Human operator linkage",
              "Delegation chain tracking",
              "Credential rotation",
            ]}
          />
          <PrimitiveCard
            title="Policy Posture Specs"
            items={[
              "Declarative policy as code",
              "Context-aware conditions",
              "Approval workflows",
              "Versioned policy sets",
            ]}
          />
          <PrimitiveCard
            title="Evidence Records"
            items={[
              "Cryptographic integrity",
              "Selective disclosure",
              "Audit log export",
              "Long-term retention",
            ]}
          />
        </ThreeCol>
      </Band>

      <Band className={styles.band}>
        <SectionHeading eyebrow="TRACE CAPABILITIES" title="Built for the evidence lifecycle." />
        <ThreeCol>
          <InfoBlock
            icon={<FileSearch />}
            title="Observe mode"
            text="Capture every prompt, output, tool call, and user action without blocking workflows. Flag risks, emit evidence."
          />
          <InfoBlock
            icon={<ShieldCheck />}
            title="Enforce mode"
            text="Graduate rules to blocking. Return standardized errors to agents. Evidence still emitted for every decision."
          />
          <InfoBlock
            icon={<Network />}
            title="Ingestion & replay"
            text="REST endpoints for agent events. Session replay with hash chaining. Analytics over stored usage."
          />
        </ThreeCol>
      </Band>

      <Band className={styles.band}>
        <SectionHeading eyebrow="DEPLOYMENT" title="Designed for enterprise data sovereignty." />
        <ThreeCol>
          <InfoBlock
            icon={<Network />}
            title="Data plane in your VPC"
            text="Telemetry ingestion, policy evaluation, and evidence persistence run inside your infrastructure."
          />
          <InfoBlock
            icon={<GitBranch />}
            title="Control plane flexibility"
            text="Managed option later. Self-hosted today. Workflow clustering, primitive registry, deployment orchestration."
          />
          <InfoBlock
            icon={<LockKeyhole />}
            title="Trust plane"
            text="Audit-ready export. Identity and authority management. No vendor lock-in on your evidence."
          />
        </ThreeCol>
      </Band>
    </main>
  );
}
