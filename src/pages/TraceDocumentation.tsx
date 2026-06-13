import { ArrowRight, ClipboardCheck, FileSearch, GitBranch, ShieldCheck } from "lucide-react";
import { Band, ClosingCTA, Hero, SectionHeading } from "./components";
import { HeroVisual } from "../components/visual";
import { DocsCard, InfoBlock } from "../components/common";
import { Button } from "../components/ui";
import { routes } from "../utils/navigation";
import { useNavigate } from "react-router-dom";
import styles from "./TraceDocumentation.module.css";

export function TraceDocumentation() {
  const navigate = useNavigate();
  return (
    <main className={styles.page}>
      <Hero
        className={styles.hero}
        badge={{
          label: "Trace Documentation",
          title: "Developer guide for the evidence layer",
        }}
        title="Run Trace locally. Inspect what your agents actually did."
        text="These docs walk through one proof path: boot the data plane, send an agent action, compare observe vs enforce behavior, then read the tamper-evident record that explains what happened and why."
        actions={[
          <Button key="demo" variant="primary" onClick={() => navigate(routes.demo)}>
            Request demo <ArrowRight size={18} />
          </Button>,
          <Button key="trace" variant="secondary" onClick={() => navigate(routes.trace)}>
            Return to Trace
          </Button>,
        ]}
      >
        <HeroVisual variant="docs" />
      </Hero>

      <Band className={styles.band}>
        <SectionHeading eyebrow="THE PROOF PATH" title="Three steps from installation to verifiable evidence." />
        <div className={styles.proofPath}>
          <article>
            <span>01</span>
            <h3>Boot the data plane</h3>
            <p>Clone, build, and run the Trace service. All evidence stays on your machine — nothing leaves your local environment.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Replay an action in both modes</h3>
            <p>Observe mode captures the decision without interfering. Enforce mode captures and blocks when policy says no.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Inspect the evidence record</h3>
            <p>Read the structured output: agent identity, policy evaluation, tool payload, hash chain, and full replay context.</p>
          </article>
        </div>
      </Band>

      <Band className={styles.band}>
        <SectionHeading eyebrow="QUICKSTART" title="Clone, build, and run your first evidence capture." />
        <div className={styles.codeSection}>
          <article className={styles.codeCard}>
            <h3>Install and run</h3>
            <pre className={styles.codeBlock}>{`# Clone and install
git clone https://github.com/Olea-Computer/StriaSystems
cd StriaSystems/trace-core
cargo build --release

# Run the data plane
./target/release/trace-data-plane`}</pre>
          </article>
          <article className={styles.codeCard}>
            <h3>Compare modes</h3>
            <pre className={styles.codeBlock}>{`# List available fixtures
trace-cli fixtures list

# Run observe mode (capture + evaluate, no blocking)
trace-cli run --mode observe --fixture payment_action

# Run enforce mode (capture + evaluate + block)
trace-cli run --mode enforce --fixture payment_action`}</pre>
          </article>
          <article className={styles.codeCard}>
            <h3>Post your own event</h3>
            <pre className={styles.codeBlock}>{`# Post your own agent event
trace-cli post --input '{
  "agent_id": "support-copilot",
  "action": "refund_approval",
  "payload": { "amount": 150, "reason": "customer_request" }
}'`}</pre>
          </article>
        </div>
      </Band>

      <Band className={styles.band}>
        <SectionHeading eyebrow="COMMON QUESTIONS" title="Navigate by what you need to know, not where files live." />
        <div className={styles.questionGrid}>
          <DocsCard
            icon={<GitBranch />}
            title="Can I run it locally?"
            text="Start with local data plane setup, fixture replay, and binary installation."
          />
          <DocsCard
            icon={<FileSearch />}
            title="What does an event need?"
            text="Read the event schema, required fields, and payload examples for common agent actions."
          />
          <DocsCard
            icon={<ShieldCheck />}
            title="Why did Trace allow or block?"
            text="Compare observe vs enforce behavior, policy evaluation, and standardized error handling."
          />
          <DocsCard
            icon={<ClipboardCheck />}
            title="What survives audit?"
            text="Inspect evidence record format, verification, hash chaining, and export paths."
          />
        </div>
      </Band>

      <Band className={styles.band}>
        <SectionHeading eyebrow="API REFERENCE" title="Three endpoints cover the entire local data-plane surface." />
        <div className={styles.serviceGrid}>
          <InfoBlock
            icon={<FileSearch />}
            title="Playground"
            text="http://localhost:8787/: Managed AI usage classification with intent, risk, domain alignment, and evidence preview."
          />
          <InfoBlock
            icon={<GitBranch />}
            title="Fixtures API"
            text="GET /trace/fixtures: List test fixtures. POST /trace/fixtures/:id/run?mode=observe|enforce: Run fixture."
          />
          <InfoBlock
            icon={<ShieldCheck />}
            title="Ingestion API"
            text="POST /trace/ingest?mode=observe|enforce: Ingest tenant-owned events. GET /trace/events: Query stored events."
          />
        </div>
      </Band>

      <ClosingCTA
        eyebrow="PROTOTYPE STATUS"
        title="One fixture should prove the behavioral difference."
        text="Run the same payment action in observe and enforce mode. The comparison should make the Trace value obvious: every decision remains attributable, explainable, and replayable."
        action={
          <Button variant="primary" onClick={() => navigate(routes.demo)}>
            Request demo <ArrowRight size={18} />
          </Button>
        }
      />
    </main>
  );
}
