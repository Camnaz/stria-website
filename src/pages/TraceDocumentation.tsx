import { ArrowRight, ClipboardCheck, FileSearch, GitBranch, ShieldCheck } from "lucide-react";
import { Band, ClosingCTA, Hero, SectionHeading, ThreeCol } from "./components";
import { SystemBackdrop } from "../components/visual";
import { DocsCard, InfoBlock } from "../components/common";
import { Button } from "../components/ui";
import { navigate, routes } from "../utils/navigation";
import styles from "./TraceDocumentation.module.css";

export function TraceDocumentation() {
  return (
    <main className={styles.page}>
      <Hero
        className={styles.hero}
        badge={{
          label: "Trace Documentation",
          title: "Local prototype & evidence schema",
        }}
        title="Run Trace locally and inspect agent evidence records."
        text="The local prototype demonstrates the full evidence lifecycle — from agent event ingestion through policy evaluation to evidence record emission. No cloud dependency required."
        actions={[
          <Button key="demo" variant="primary" onClick={() => navigate(routes.demo)}>
            Request demo <ArrowRight size={18} />
          </Button>,
          <Button key="trace" variant="secondary" onClick={() => navigate(routes.trace)}>
            Return to Trace
          </Button>,
        ]}
      >
        <SystemBackdrop />
      </Hero>

      <Band className={styles.band}>
        <SectionHeading eyebrow="GETTING STARTED" title="Bring up a local Trace data-plane demo in one bootstrap command." />
        <div className={styles.codeSection}>
          <pre className={styles.codeBlock}>{`# Clone and install
git clone https://github.com/Olea-Computer/StriaSystems
cd StriaSystems/trace-core
cargo build --release

# Run the data plane
./target/release/trace-data-plane`}</pre>
          <pre className={styles.codeBlock}>{`# List available fixtures
trace-cli fixtures list

# Run observe mode (capture + evaluate, no blocking)
trace-cli run --mode observe --fixture payment_action

# Run enforce mode (capture + evaluate + block)
trace-cli run --mode enforce --fixture payment_action`}</pre>
          <pre className={styles.codeBlock}>{`# Post your own agent event
trace-cli post --input '{
  "agent_id": "support-copilot",
  "action": "refund_approval",
  "payload": { "amount": 150, "reason": "customer_request" }
}'`}</pre>
        </div>
      </Band>

      <Band className={styles.band}>
        <SectionHeading eyebrow="DOCUMENTATION AREAS" title="Explore the evidence schema and runtime behavior." />
        <ThreeCol>
          <DocsCard
            icon={<GitBranch />}
            title="Clone and Run"
            text="Local data plane setup, Docker images, and binary installation."
          />
          <DocsCard
            icon={<FileSearch />}
            title="Post Agent Events"
            text="Event schema, required fields, and example payloads for common agents."
          />
          <DocsCard
            icon={<ShieldCheck />}
            title="Switch Modes"
            text="Observe vs Enforce mode behavior, policy evaluation, and error handling."
          />
          <DocsCard
            icon={<ClipboardCheck />}
            title="Inspect Evidence"
            text="Evidence record format, verification, and export for audit workflows."
          />
        </ThreeCol>
      </Band>

      <Band className={styles.band}>
        <SectionHeading eyebrow="LOCAL SERVICE" title="The served prototype exposes a playground and REST endpoints." />
        <ThreeCol>
          <InfoBlock
            icon={<FileSearch />}
            title="Playground"
            text="http://localhost:8787/ — Managed AI usage classification with intent, risk, domain alignment, and evidence preview."
          />
          <InfoBlock
            icon={<GitBranch />}
            title="Fixtures API"
            text="GET /trace/fixtures — List test fixtures. POST /trace/fixtures/:id/run?mode=observe|enforce — Run fixture."
          />
          <InfoBlock
            icon={<ShieldCheck />}
            title="Ingestion API"
            text="POST /trace/ingest?mode=observe|enforce — Ingest tenant-owned events. GET /trace/events — Query stored events."
          />
        </ThreeCol>
      </Band>

      <ClosingCTA
        eyebrow="PROTOTYPE STATUS"
        title="The served prototype exposes just enough surface to test Trace behavior."
        text="The same payment action should prove observe and enforce behavior. Run both modes and compare evidence records."
        action={
          <Button variant="primary" onClick={() => navigate(routes.demo)}>
            Request demo <ArrowRight size={18} />
          </Button>
        }
      />
    </main>
  );
}