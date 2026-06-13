import {
  ArrowRight,
  Network,
  ShieldCheck,
  ClipboardCheck,
  FileSearch,
  GitBranch,
  Database,
} from "lucide-react";
import {
  Hero,
  Band,
  SectionHeading,
  ThreeCol,
  ProductCallout,
  ModeGrid,
  AudienceGrid,
  ClosingCTA,
} from "./components";
import { HeroVisual } from "../components/visual";
import { InfoBlock, ModeColumn } from "../components/common";
import { Button } from "../components/ui";
import { useNavigate } from "react-router-dom";
import { routes } from "../utils/navigation";
import styles from "./CompanyHome.module.css";

export function CompanyHome() {
  const navigate = useNavigate();
  return (
    <main>
      <Hero
        className={styles.hero}
        badge={{
          label: "Stria Systems",
          title: "The evidence layer for enterprise AI",
        }}
        title="AI is doing the work. Stria proves it did it right."
        text="Every prompt, tool call, and automated action leaves a trail. Stria turns that trail into evidence, then turns repeated work into verified execution infrastructure."
        bullets={[
          "Trace LLM usage, tool calls, cost, and failures",
          "Cluster repeated workflows from telemetry",
          "Verify deterministic primitives before deployment",
        ]}
        actions={[
          (
            <Button key="platform" variant="primary" onClick={() => navigate(routes.platform)}>
              View platform <ArrowRight size={18} />
            </Button>
          ),
          (
            <Button key="forge" variant="secondary" onClick={() => navigate(routes.forge)}>
              Explore Forge
            </Button>
          ),
        ]}
      >
        <HeroVisual variant="home" />
      </Hero>

      <Band className={styles.band}>
        <SectionHeading eyebrow="Execution Accountability" title="Evidence that survives audit scrutiny." />
        <ThreeCol>
          <InfoBlock
            icon={<Network />}
            title="Beyond model calls"
            text="Existing observability focuses on logs and traces. Stria focuses on delegated execution and accountable action."
          />
          <InfoBlock
            icon={<ShieldCheck />}
            title="Beyond prompt review"
            text="Governance often stops at prompts and outputs. Stria tracks the authority, policy, and workflow state behind every action."
          />
          <InfoBlock
            icon={<ClipboardCheck />}
            title="Low-friction controls"
            text="A consistent policy and evidence layer that works without rewriting every agent workflow from scratch."
          />
        </ThreeCol>
      </Band>

      <ProductCallout
        className={styles.callout}
        eyebrow="The Stria Approach"
        title="Evidence before enforcement."
        text="Capture evidence first, then enforce. Trace runs in observe mode to build a baseline, then graduates rules to enforce mode once teams understand production patterns."
      >
        <ModeGrid
          columns={[
            { title: "Observe mode", items: ["capture action", "evaluate policy", "flag risk", "allow workflow to continue", "emit evidence"] },
            { title: "Enforce mode", items: ["capture action", "evaluate policy", "block violations", "return standardized error", "emit evidence"] },
          ]}
        />
      </ProductCallout>

      <Band className={styles.band}>
        <SectionHeading eyebrow="Platform Products" title="Trace observes. Forge verifies." />
        <ThreeCol>
          <InfoBlock
            icon={<FileSearch />}
            title="Stria Trace"
            text="Observe, attribute, and audit LLM usage across prompts, outputs, tools, cost, latency, and compliance events."
          />
          <InfoBlock
            icon={<GitBranch />}
            title="Stria Forge"
            text="Turn repeated AI workflows into verified execution primitives with tests, scoring, registry metadata, and deployment feedback."
          />
          <InfoBlock
            icon={<Database />}
            title="Shared data layer"
            text="Organizations, traces, workflow clusters, primitives, evaluations, deployments, and authentication under one platform."
          />
        </ThreeCol>
        <div className={styles.actions}>
          <Button variant="primary" onClick={() => navigate(routes.platform)}>
            View platform dashboard <ArrowRight size={18} />
          </Button>
        </div>
      </Band>

      <Band className={`${styles.band} ${styles.compact}`}>
        <SectionHeading eyebrow="Audience" title="Built for the teams responsible for AI risk." />
        <AudienceGrid>
          <div className={styles.principle}>
            <h3>CISO</h3>
            <p>Know which agents acted, what they touched, and whether they violated policy.</p>
          </div>
          <div className={styles.principle}>
            <h3>General Counsel</h3>
            <p>Retain audit-ready evidence for AI-driven business actions.</p>
          </div>
          <div className={styles.principle}>
            <h3>AI Platform Teams</h3>
            <p>Route agent execution through a consistent identity, policy, and evidence layer.</p>
          </div>
          <div className={styles.principle}>
            <h3>Compliance</h3>
            <p>Map actions, approvals, and outcomes to control evidence.</p>
          </div>
          <div className={styles.principle}>
            <h3>Operations</h3>
            <p>Find workflow delays, review bottlenecks, and over-restrictive policies.</p>
          </div>
        </AudienceGrid>
      </Band>

      <ClosingCTA
        eyebrow="Accountable Autonomy"
        title="Delegate the work. Keep the receipts."
        text="The next decade of work runs on delegated authority. Stria is the layer that lets enterprises hand real work to autonomous systems and prove, at any moment, exactly what happened."
        action={
          <Button variant="primary" onClick={() => navigate(routes.trace)}>
            Explore Trace <ArrowRight size={18} />
          </Button>
        }
      />
    </main>
  );
}
