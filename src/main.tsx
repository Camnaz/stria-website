import React from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  BookOpenText,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSearch,
  Fingerprint,
  GitBranch,
  LockKeyhole,
  Network,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import "./styles.css";
import "./styles/animations.css";
import { deployments, evaluationRuns, forgePrimitives, scorePrimitive, traceEvents, workflowClusters, type ForgePrimitive, type WorkflowCluster } from "./striaPlatformData";
import { prefersReducedMotion, scrollToTop, useScroll3D } from "./hooks/useScrollAnimation";

type Surface = "company" | "platform" | "trace" | "forge" | "architecture" | "traceDocs" | "demo";

const routes: Record<Surface, string> = {
  company: "/",
  platform: "/platform",
  trace: "/trace",
  forge: "/forge",
  architecture: "/architecture",
  traceDocs: "/trace/documentation",
  demo: "/demo",
};

const getSurface = (): Surface => {
  const path = window.location.pathname;

  if (path === "/docs") return "traceDocs";
  if (path === "/platform") return "platform";
  if (path === "/architecture") return "architecture";
  if (path === "/forge" || path.startsWith("/forge/")) return "forge";
  if (path === "/trace/documentation" || path === "/trace/docs") return "traceDocs";
  if (path === "/trace" || path.startsWith("/trace/")) return "trace";
  if (path === "/demo" || path.startsWith("/demo/")) return "demo";

  return "company";
};

const navigate = (path: string) => {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

function App() {
  const [surface, setSurface] = React.useState<Surface>(getSurface);

  React.useEffect(() => {
    const onPop = () => setSurface(getSurface());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  React.useEffect(() => {
    if (window.location.pathname === "/trace/docs" || window.location.pathname === "/docs") {
      navigate(routes.traceDocs);
    }
  }, []);

  React.useEffect(() => {
    const metadata: Record<Surface, { title: string; description: string }> = {
      company: {
        title: "Stria Systems | Trustworthy Infrastructure for Enterprise AI",
        description: "Stria Systems builds Trace and Forge: enterprise AI infrastructure for LLM observability, auditability, deterministic execution, and verified automation.",
      },
      platform: {
        title: "Stria Platform | Trace and Forge",
        description: "Explore the shared Stria platform flow from LLM usage telemetry to workflow clustering, Forge recommendations, verified primitives, and monitored deployment.",
      },
      trace: {
        title: "Stria Trace | AI Observability and Audit Layer",
        description: "Observe, attribute, and audit how your organization uses LLMs with prompt, output, tool-call, cost, latency, failure, and compliance telemetry.",
      },
      forge: {
        title: "Stria Forge | Verified Execution Primitives",
        description: "Turn repeated AI workflows into verified, optimized execution primitives with sandboxed tests, scoring, versioning, and deployment metadata.",
      },
      architecture: {
        title: "Architecture | Stria Systems",
        description: "Explore the Trace data plane, control plane, and trust plane architecture for accountable AI execution.",
      },
      traceDocs: {
        title: "Trace Developer Docs | Stria Systems",
        description: "Run the Trace local prototype, replay agent-event fixtures, post custom actions, and inspect schema-valid AI evidence records.",
      },
      demo: {
        title: "Request Demo | Stria Systems",
        description: "Request a Trace demo for enterprise AI workflows that need identity, policy evaluation, evidence records, and operational intelligence.",
      },
    };

    document.title = metadata[surface].title;
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    description.content = metadata[surface].description;
  }, [surface]);

  React.useEffect(() => {
    let frame = 0;
    const updateCursorField = (event: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        document.documentElement.style.setProperty("--cursor-x", `${event.clientX}px`);
        document.documentElement.style.setProperty("--cursor-y", `${event.clientY}px`);
        frame = 0;
      });
    };

    window.addEventListener("pointermove", updateCursorField, { passive: true });
    return () => {
      window.removeEventListener("pointermove", updateCursorField);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  React.useEffect(() => {
    scrollToTop(true);
  }, [surface]);

  return (
    <SiteShell surface={surface}>
        {surface === "company" && <CompanyHome />}
        {surface === "platform" && <PlatformDashboard />}
        {surface === "trace" && <TraceProduct />}
        {surface === "forge" && <ForgeProduct />}
        {surface === "architecture" && <ArchitectureOverview />}
        {surface === "traceDocs" && <TraceDocumentation />}
        {surface === "demo" && <DemoRequest />}
      </SiteShell>
  );
}

function SiteShell({ children, surface }: { children: React.ReactNode; surface: Surface }) {
  const headerRef = React.useRef<HTMLElement>(null);

  // Apple-style header state on scroll
  React.useEffect(() => {
    let rafId = 0;
    const header = headerRef.current;
    if (!header) return;

    const handleScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        header.classList.toggle("is-scrolled", window.scrollY > 20);
        rafId = 0;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className={`site-shell surface-${surface}`} data-surface={surface}>
      <header ref={headerRef} className="site-header">
        <BrandButton />

        <nav className="site-nav" aria-label="Primary navigation">
          <button className={surface === "company" ? "active" : ""} onClick={() => navigate(routes.company)}>
            Company
          </button>
          <button className={surface === "platform" ? "active" : ""} onClick={() => navigate(routes.platform)}>
            Platform
          </button>
          <button className={surface === "trace" ? "active" : ""} onClick={() => navigate(routes.trace)}>
            Trace
          </button>
          <button className={surface === "forge" ? "active" : ""} onClick={() => navigate(routes.forge)}>
            Forge
          </button>
          <button className={surface === "architecture" ? "active" : ""} onClick={() => navigate(routes.architecture)}>
            Architecture
          </button>
          <button className={surface === "traceDocs" ? "active" : ""} onClick={() => navigate(routes.traceDocs)}>
            Docs
          </button>
        </nav>

        <button className="nav-cta" onClick={() => navigate(routes.demo)}>
          Request demo
        </button>
      </header>

      {children}

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <BrandButton variant="footer" />

      <nav className="footer-nav" aria-label="Footer navigation">
        <button onClick={() => navigate(routes.platform)}>Platform</button>
        <button onClick={() => navigate(routes.trace)}>Trace</button>
        <button onClick={() => navigate(routes.forge)}>Forge</button>
        <button onClick={() => navigate(routes.architecture)}>Architecture</button>
        <button onClick={() => navigate(routes.traceDocs)}>Docs</button>
        <button onClick={() => navigate(routes.demo)}>Demo</button>
      </nav>

      <span className="footer-credit">Stria Systems</span>
    </footer>
  );
}

function BrandButton({ variant }: { variant?: "footer" }) {
  return (
    <button className={`brand ${variant === "footer" ? "footer-brand" : ""}`} onClick={() => navigate(routes.company)} aria-label="Stria Systems home">
      <img className="brand-logo" src="/assets/stria-systems-obsidian-400.png" alt="Stria Systems" />
    </button>
  );
}

function CompanyHome() {
  return (
    <main>
      <section className="hero company-hero">
        <SystemBackdrop />
        <div className="hero-content">
          <div className="surface-badge">
            <span>Stria Systems</span>
            <strong>The evidence layer for enterprise AI</strong>
          </div>
          <h1>AI is doing the work. Stria proves it did it right.</h1>
          <p className="hero-text">
            Every prompt, tool call, and automated action leaves a trail. Stria turns that trail into evidence — then the work that repeats into verified execution infrastructure.
          </p>
          <ul className="hero-bullets" aria-label="Stria capabilities">
            <li>Trace LLM usage, tool calls, cost, and failures</li>
            <li>Cluster repeated workflows from telemetry</li>
            <li>Verify deterministic primitives before deployment</li>
          </ul>
          <div className="hero-actions">
            <button className="primary" onClick={() => navigate(routes.platform)}>
              View platform <ArrowRight size={18} />
            </button>
            <button className="secondary" onClick={() => navigate(routes.forge)}>
              Explore Forge
            </button>
          </div>
        </div>
        <StriaKineticScene />
      </section>

      <section className="band">
        <div className="section-heading">
          <p className="eyebrow">Execution Accountability</p>
          <h2>Evidence that survives audit scrutiny.</h2>
        </div>
        <div className="three-col">
          <InfoBlock icon={<Network />} title="Beyond model calls" text="Existing observability focuses on logs and traces. Stria focuses on delegated execution and accountable action." />
          <InfoBlock icon={<ShieldCheck />} title="Beyond prompt review" text="Governance often stops at prompts and outputs. Stria tracks the authority, policy, and workflow state behind every action." />
          <InfoBlock icon={<ClipboardCheck />} title="Low-friction controls" text="A consistent policy and evidence layer that works without rewriting every agent workflow from scratch." />
        </div>
      </section>

      <section className="product-callout">
        <div className="callout-copy">
          <p className="eyebrow">The Stria Approach</p>
          <h2>Evidence before enforcement.</h2>
          <p>
            Capture evidence first, then enforce. Trace runs in observe mode to build a baseline, then graduates rules to enforce mode once teams understand production patterns.
          </p>
        </div>
        <div className="mode-grid">
          <ModeColumn title="Observe mode" items={["capture action", "evaluate policy", "flag risk", "allow workflow to continue", "emit evidence"]} />
          <ModeColumn title="Enforce mode" items={["capture action", "evaluate policy", "block violations", "return standardized error", "emit evidence"]} />
        </div>
      </section>

      <section className="band">
        <div className="section-heading">
          <p className="eyebrow">Platform Products</p>
          <h2>Trace observes. Forge verifies.</h2>
        </div>
        <div className="three-col">
          <InfoBlock icon={<FileSearch />} title="Stria Trace" text="Observe, attribute, and audit LLM usage across prompts, outputs, tools, cost, latency, and compliance events." />
          <InfoBlock icon={<GitBranch />} title="Stria Forge" text="Turn repeated AI workflows into verified execution primitives with tests, scoring, registry metadata, and deployment feedback." />
          <InfoBlock icon={<Database />} title="Shared data layer" text="Organizations, traces, workflow clusters, primitives, evaluations, deployments, and authentication under one platform." />
        </div>
        <div className="hero-actions section-actions">
          <button className="primary" onClick={() => navigate(routes.platform)}>
            View platform dashboard <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <section className="band compact-band">
        <div className="section-heading">
          <p className="eyebrow">Audience</p>
          <h2>Built for the teams responsible for AI risk.</h2>
        </div>
        <div className="audience-grid">
          <Principle title="CISO" text="Know which agents acted, what they touched, and whether they violated policy." />
          <Principle title="General Counsel" text="Retain audit-ready evidence for AI-driven business actions." />
          <Principle title="AI Platform Teams" text="Route agent execution through a consistent identity, policy, and evidence layer." />
          <Principle title="Compliance" text="Map actions, approvals, and outcomes to control evidence." />
          <Principle title="Operations" text="Find workflow delays, review bottlenecks, and over-restrictive policies." />
        </div>
      </section>

      <section className="closing-cta">
        <p className="eyebrow">Accountable Autonomy</p>
        <h2>Delegate the work. Keep the receipts.</h2>
        <p>
          The next decade of work runs on delegated authority. Stria is the layer that lets enterprises hand real work to autonomous systems — and prove, at any moment, exactly what happened.
        </p>
        <button className="primary" onClick={() => navigate(routes.trace)}>
          Explore Trace <ArrowRight size={18} />
        </button>
      </section>
    </main>
  );
}

function PlatformDashboard() {
  const totalCost = traceEvents.reduce((sum, event) => sum + event.cost_estimate, 0);
  const avgLatency = Math.round(traceEvents.reduce((sum, event) => sum + event.latency_ms, 0) / traceEvents.length);
  const failures = traceEvents.filter((event) => event.status === "failed").length;
  const flagged = traceEvents.filter((event) => event.status === "flagged").length;

  return (
    <main className="platform-page">
      <section className="hero platform-hero platform-cockpit-hero">
        <SystemBackdrop />
        <div className="hero-content">
          <div className="surface-badge">
            <span>Stria Systems Platform</span>
            <strong>Trace + Forge</strong>
          </div>
          <h1>One loop. From raw AI usage to verified automation.</h1>
          <p className="hero-text">
            Trace watches what people and agents actually do with AI. Forge takes the work that repeats and forges it into tested, deterministic primitives. Every deployment feeds telemetry back into the loop.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={() => navigate(routes.trace)}>
              Explore Trace <ArrowRight size={18} />
            </button>
            <button className="secondary" onClick={() => navigate(routes.forge)}>
              Explore Forge
            </button>
          </div>
        </div>
        <RecursiveWorkflowVisual />
      </section>

      <section className="platform-flow">
        <p className="eyebrow">Platform Flow</p>
        <h2>LLM usage becomes verified automation.</h2>
        <ol className="platform-chain">
          {["LLM usage", "Trace telemetry", "Workflow clustering", "Forge recommendation", "Code and tests", "Sandbox verification", "Approved primitive registry", "Monitored deployment", "Feedback into Trace"].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-panel">
          <div className="panel-heading">
            <span>Trace dashboard</span>
            <strong>Observe, attribute, and audit how your organization uses LLMs.</strong>
          </div>
          <div className="metric-row">
            <MetricTile label="Events" value={String(traceEvents.length)} />
            <MetricTile label="Cost" value={`$${totalCost.toFixed(2)}`} />
            <MetricTile label="Avg latency" value={`${avgLatency}ms`} />
            <MetricTile label="Flagged / failed" value={`${flagged} / ${failures}`} />
          </div>
          <TraceEventTable />
        </div>

        <div className="dashboard-panel">
          <div className="panel-heading">
            <span>Forge dashboard</span>
            <strong>Turn repeated AI workflows into verified, optimized execution primitives.</strong>
          </div>
          <div className="cluster-list">
            {workflowClusters.map((cluster) => (
              <WorkflowClusterCard key={cluster.id} cluster={cluster} />
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <PrimitiveRegistry />
        <SandboxPanel />
      </section>
    </main>
  );
}

function ModeColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="mode-column">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function TraceProduct() {
  return (
    <main className="trace-page">
      <section className="hero trace-hero">
        <SystemBackdrop />
        <div className="hero-content narrow">
          <div className="surface-badge product">
            <span>Usage intelligence → Evidence → Governance</span>
            <strong>Trace by Stria Systems</strong>
          </div>
          <h1>See every AI action. Prove every AI decision.</h1>
          <p className="hero-text">
            Trace captures prompts, outputs, tool calls, user behavior, latency, cost, failure modes, and compliance-relevant events so operators can understand AI usage before they automate or enforce.
          </p>
          <div className="agentic-proofline" aria-label="Agentic-first proof points">
            <span>Local agent install</span>
            <span>Operator copilot</span>
            <span>Evidence before enforcement</span>
          </div>
          <div className="hero-actions">
            <button className="primary" onClick={() => navigate(routes.traceDocs)}>
              View developer prototype <ArrowRight size={18} />
            </button>
            <button className="secondary" onClick={() => navigate(routes.traceDocs)}>
              Read the evidence schema
            </button>
          </div>
        </div>
        <TraceObject />
      </section>

      <section className="trace-value-strip" aria-label="Trace customer value">
        <ValuePill label="Actions" text="Tool calls, resources, destinations, outcomes, and workflow state." />
        <ValuePill label="Authority" text="Agent identity, service accounts, allowed capabilities, and policy posture." />
        <ValuePill label="Accountability" text="Tamper-evident records, custody metadata, review paths, and intelligence reports." />
      </section>

      <section className="trace-signal">
        <div className="signal-copy">
          <p className="eyebrow">What Trace Does</p>
          <h2>Every AI action becomes attributable.</h2>
          <p>
            Trace sits in the execution path of AI agents and tool-using workflows. When an agent attempts an action, Trace checks who the agent is, what it is allowed to do, which policies apply, and what evidence must be retained.
          </p>
        </div>
        <FlowDiagram steps={["Agent Action", "Identity Verification", "Policy Evaluation", "Evidence Record", "Hash / Chain of Custody", "Operational Intelligence"]} />
      </section>

      <section className="band">
        <div className="section-heading">
          <p className="eyebrow">Core Primitives</p>
          <h2>The three primitives behind accountable AI execution.</h2>
        </div>
        <div className="three-col">
          <InfoBlock icon={<Fingerprint />} title="Identity Manifests" text="Machine IAM for AI agents. Define agent UUIDs, owners, environments, service accounts, allowed tools, denied capabilities, destinations, and scopes." />
          <InfoBlock icon={<SlidersHorizontal />} title="Policy Posture Specs" text="Rules define operational boundaries. Policies can run in observe mode or enforce mode so teams safely graduate from visibility to control." />
          <InfoBlock icon={<FileSearch />} title="Evidence Records" text="Structured, tamper-evident records of AI actions, including prompts, context hashes, tool calls, policy evaluations, timing, outcomes, and custody metadata." />
        </div>
      </section>

      <section className="trace-middleware">
        <div className="mode-grid">
          <ModeColumn title="Observe mode" items={["logs and evaluates actions", "flags violations", "captures evidence", "allows traffic to continue", "builds policy baseline"]} />
          <ModeColumn title="Enforce mode" items={["blocks configured violations", "returns standardized errors", "preserves evidence records", "supports hard and soft interrupts", "protects critical systems"]} />
        </div>
        <div className="middleware-copy">
          <p className="eyebrow">Observe Before Enforce</p>
          <h2>Start with visibility. Graduate to control.</h2>
          <p>
            Trace is designed for production adoption without breaking workflows on day one. Teams can run Trace in observe mode to understand agent behavior before activating enforcement on high-confidence rules.
          </p>
        </div>
      </section>

      <section className="trace-console-band">
        <div className="console-copy">
          <p className="eyebrow">Operator Copilot</p>
          <h2>A mini-agent for reviewing AI activity.</h2>
          <p>
            Trace packages evidence, policy posture, identity, and risk into an operator workflow. When malicious LLM intent appears, the interface suggests follow-up questions and answers them from the captured event data.
          </p>
          <p className="callout-text">
            Model interpretability asks why a model produced text. Trace asks why an AI system took action.
          </p>
        </div>
        <OperatorCanvas />
      </section>

      <section className="split-section">
        <div>
          <p className="eyebrow">Intelligence Layer</p>
          <h2>Turn AI execution history into operational intelligence.</h2>
          <p>
            Trace Intelligence analyzes evidence records to identify slow approvals, high-friction policies, risky agents, blocked workflows, repeated retries, authorization gaps, over-reviewed actions, and under-protected workflows.
          </p>
        </div>
        <div className="insight-grid">
          <InsightCard title="Policy friction" text="Payment threshold policy flagged 500 actions. Humans approved 94%. Recommendation: consider vendor trust tiers or threshold adjustment." />
          <InsightCard title="Delay detection" text="Average approval delay for accounts payable workflows is 17.4 hours. Recommendation: add secondary approvers." />
          <InsightCard title="Agent trust" text="accounts-payable-agent-17 has a 91.8 trust score with low block rate but frequent review escalation." />
        </div>
      </section>

      <section className="band">
        <div className="section-heading">
          <p className="eyebrow">Evidence Schema Preview</p>
          <h2>Audit-ready by design.</h2>
        </div>
        <pre className="schema-preview">{`{
  "record_id": "rec_...",
  "agent_id": "accounts-payable-agent-17",
  "action": "stripe.payment_drafts.create",
  "final_decision": "flag",
  "action_allowed": true,
  "triggered_rules": ["payment_threshold_10000"],
  "requires_human_review": true,
  "canonical_record_hash": "sha256:..."
}`}</pre>
      </section>

      <section className="band compact-band">
        <div className="section-heading">
          <p className="eyebrow">Deployment Model</p>
          <h2>Designed for customer-controlled environments.</h2>
          <p>
            Trace is designed to run close to the systems it protects. The future data plane can be deployed inside the customer VPC so sensitive prompts, tool arguments, and business records remain under customer control.
          </p>
        </div>
        <div className="deployment-notes">
          <span>Local-first developer prototype</span>
          <span>Agentic-first local install</span>
          <span>Future VPC data plane</span>
          <span>Self-hosted evidence storage option</span>
          <span>Managed control plane option later</span>
          <span>Trust plane for hash anchoring</span>
        </div>
      </section>

      <section className="docs-band">
        <div className="section-heading">
          <p className="eyebrow">Developer Prototype</p>
          <h2>Install locally and start the core loop.</h2>
          <p>
            Trace is being designed agentic-first: the runtime should be easy to install on a local machine, development workstation, CI runner, or enterprise-managed environment before it becomes a larger control-plane deployment.
          </p>
        </div>
        <div className="docs-command-stack">
          <code>npm run trace:install</code>
          <code>npm run trace:serve</code>
          <code>curl -X POST "http://localhost:8787/trace/fixtures/payment-draft-above-threshold/run?mode=observe"</code>
          <code>curl -X POST "http://localhost:8787/trace/fixtures/payment-draft-above-threshold/run?mode=enforce"</code>
          <code>npm run trace:simulate</code>
        </div>
      </section>

      <section className="closing-cta trace-closing">
        <p className="eyebrow">Accountable AI Execution</p>
        <h2>Give autonomous systems an evidence layer.</h2>
        <p>
          Trace helps enterprises move from AI experimentation to accountable autonomous execution.
        </p>
        <button className="primary" onClick={() => navigate(routes.traceDocs)}>
          Start with the prototype <ArrowRight size={18} />
        </button>
      </section>
    </main>
  );
}

function FlowDiagram({ steps }: { steps: string[] }) {
  const { ref, isInView } = useScroll3D();

  return (
    <ol ref={ref} className={`flow-diagram scroll-3d-list ${isInView ? "is-in-view" : ""}`} aria-label="Trace execution flow">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}

function ForgeProduct() {
  return (
    <main className="platform-page forge-page">
      <section className="hero forge-hero">
        <SystemBackdrop />
        <div className="hero-content">
          <div className="surface-badge product">
            <span>Stria Forge</span>
            <strong>Verified execution layer</strong>
          </div>
          <h1>When AI work repeats, forge it into infrastructure.</h1>
          <p className="hero-text">
            Forge identifies high-value workflows from Trace telemetry, generates or accepts primitive implementations, verifies them in a sandbox, scores performance, and promotes approved versions into a registry.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={() => navigate(routes.platform)}>
              View platform dashboard <ArrowRight size={18} />
            </button>
            <button className="secondary" onClick={() => navigate(routes.trace)}>
              See Trace telemetry
            </button>
          </div>
        </div>
        <ForgeObject />
      </section>

      <section className="platform-flow">
        <p className="eyebrow">Forge Boundary</p>
        <h2>Forge does not replace agents. It gives repeated agent work a tested execution path.</h2>
        <div className="three-col">
          <InfoBlock icon={<GitBranch />} title="Recommendation" text="Trace clusters repeated LLM usage by cost, frequency, latency, and failure rate. Forge recommends the workflows most ready for deterministic execution." />
          <InfoBlock icon={<ScanLine />} title="Verification" text="Generated or uploaded code runs against deterministic tests before it can become an approved primitive." />
          <InfoBlock icon={<ShieldCheck />} title="Registry" text="Approved primitives are versioned, scored, deployed, and monitored through Trace feedback." />
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-panel">
          <div className="panel-heading">
            <span>Candidate workflows</span>
            <strong>Forge starts where Trace sees repetition and measurable value.</strong>
          </div>
          <div className="cluster-list">
            {workflowClusters.map((cluster) => (
              <WorkflowClusterCard key={cluster.id} cluster={cluster} />
            ))}
          </div>
        </div>
        <PrimitiveRegistry />
      </section>

      <section className="dashboard-grid">
        <SandboxPanel />
        <div className="dashboard-panel">
          <div className="panel-heading">
            <span>Clean API boundary</span>
            <strong>Trace produces telemetry. Forge consumes workflow candidates and returns approved primitives.</strong>
          </div>
          <pre className="schema-preview">{`POST /forge/workflow-candidates
{
  "workflow_cluster_id": "wf_refund_exception",
  "source": "trace",
  "score_threshold": 85
}

POST /forge/primitives/:id/evaluate
POST /forge/primitives/:id/deploy
GET  /trace/events?primitive_id=...`}</pre>
        </div>
      </section>
    </main>
  );
}

function TraceEventTable() {
  return (
    <div className="data-table" role="table" aria-label="Trace event telemetry">
      <div className="table-row table-head" role="row">
        <span>Event</span>
        <span>App</span>
        <span>Status</span>
        <span>Latency</span>
        <span>Cost</span>
      </div>
      {traceEvents.map((event) => (
        <div className="table-row" role="row" key={event.id}>
          <span>{event.id}</span>
          <span>{event.app_id}</span>
          <span className={`status-pill ${event.status}`}>{event.status}</span>
          <span>{event.latency_ms}ms</span>
          <span>${event.cost_estimate.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
}

function WorkflowClusterCard({ cluster }: { cluster: WorkflowCluster }) {
  return (
    <article className={cluster.recommended_for_forge ? "cluster-card recommended" : "cluster-card"}>
      <div>
        <span>{cluster.id}</span>
        <h3>{cluster.name}</h3>
        <p>{cluster.description}</p>
      </div>
      <div className="cluster-metrics">
        <MetricTile label="Frequency" value={String(cluster.frequency)} />
        <MetricTile label="Avg cost" value={`$${cluster.avg_cost.toFixed(3)}`} />
        <MetricTile label="Failure" value={`${Math.round(cluster.failure_rate * 100)}%`} />
        <MetricTile label="Forge score" value={String(cluster.automation_score)} />
      </div>
      <strong>{cluster.recommended_for_forge ? "Recommended for Forge" : "Keep observing"}</strong>
    </article>
  );
}

function PrimitiveRegistry() {
  return (
    <div className="dashboard-panel">
      <div className="panel-heading">
        <span>Primitive registry</span>
        <strong>Approved automation is versioned, tested, scored, and deployable.</strong>
      </div>
      <div className="primitive-list">
        {forgePrimitives.map((primitive) => (
          <PrimitiveCard key={primitive.id} primitive={primitive} />
        ))}
      </div>
    </div>
  );
}

function PrimitiveCard({ primitive }: { primitive: ForgePrimitive }) {
  const evaluation = evaluationRuns.find((run) => run.primitive_id === primitive.id);
  const deployment = deployments.find((item) => item.primitive_id === primitive.id);

  return (
    <article className="primitive-card">
      <div className="primitive-title">
        <div>
          <span>{primitive.id}</span>
          <h3>{primitive.name}</h3>
        </div>
        <strong className={`status-pill ${primitive.status}`}>{primitive.status}</strong>
      </div>
      <p>{primitive.description}</p>
      <div className="cluster-metrics">
        <MetricTile label="Version" value={primitive.version} />
        <MetricTile label="Score" value={String(scorePrimitive(primitive))} />
        <MetricTile label="Tests" value={evaluation ? `${evaluation.tests_passed}/${evaluation.tests_passed + evaluation.tests_failed}` : "not run"} />
        <MetricTile label="Deploy" value={deployment ? deployment.environment : "none"} />
      </div>
    </article>
  );
}

function SandboxPanel() {
  const activeRun = evaluationRuns[0];
  return (
    <div className="dashboard-panel sandbox-panel">
      <div className="panel-heading">
        <span>Sandbox execution</span>
        <strong>Run generated or uploaded code against deterministic test cases before deployment.</strong>
      </div>
      <div className="sandbox-console">
        <div className="visual-header">
          <span>{activeRun.id}</span>
          <strong>{activeRun.status}</strong>
        </div>
        <pre>{activeRun.logs.map((log) => `✓ ${log}`).join("\n")}</pre>
      </div>
      <div className="metric-row">
        <MetricTile label="Passed" value={String(activeRun.tests_passed)} />
        <MetricTile label="Failed" value={String(activeRun.tests_failed)} />
        <MetricTile label="Latency" value={`${activeRun.latency_ms}ms`} />
        <MetricTile label="Reward" value={String(activeRun.reward_score)} />
      </div>
    </div>
  );
}

function InsightCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="insight-card">
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function ArchitectureOverview() {
  return (
    <main>
      <section className="hero company-hero architecture-hero">
        <SystemBackdrop />
        <div className="hero-content">
          <div className="surface-badge">
            <span>Architecture</span>
            <strong>Stria Systems</strong>
          </div>
          <h1>One platform layer for observable and verified AI execution.</h1>
          <p className="hero-text">
            Stria combines Trace telemetry, Forge primitive verification, a customer-controlled data plane, and a trust plane for audit-ready evidence.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={() => navigate(routes.traceDocs)}>
              View developer docs <ArrowRight size={18} />
            </button>
            <button className="secondary" onClick={() => navigate(routes.trace)}>
              Back to Trace
            </button>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="section-heading">
          <p className="eyebrow">Architecture Model</p>
          <h2>Designed for data sovereignty and auditability.</h2>
          <p>
            The current prototype proves the local data-plane loop. Future deployment separates capture, governance, primitive verification, and trust anchoring so enterprises can keep sensitive execution data close to the systems it protects.
          </p>
        </div>
        <div className="three-col">
          <InfoBlock icon={<Database />} title="Data Plane" text="Runs inside the customer environment. Captures agent actions, verifies identity, evaluates policy, emits evidence, and optionally blocks configured violations." />
          <InfoBlock icon={<Building2 />} title="Control Plane" text="Manages identities, policies, environments, evidence search, review workflows, integrations, and operational intelligence." />
          <InfoBlock icon={<LockKeyhole />} title="Trust Plane" text="Aggregates evidence hashes, creates verification roots, and supports tamper-evident audit checks without overexposing sensitive payloads." />
        </div>
      </section>

      <section className="platform-flow">
        <p className="eyebrow">Trace + Forge Boundary</p>
        <h2>Telemetry stays observable. Automation becomes verified.</h2>
        <ol className="platform-chain">
          {["TraceEvent", "WorkflowCluster", "ForgePrimitive", "EvaluationRun", "Deployment", "Feedback into Trace"].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="product-callout">
        <div className="callout-copy">
          <p className="eyebrow">Execution Path</p>
          <h2>Identity → policy → evidence → clustering → verification.</h2>
          <p>
            Trace focuses on observable enterprise execution factors. Forge consumes the repeated workflows Trace discovers and turns selected work into tested, versioned primitives.
          </p>
        </div>
        <FlowDiagram steps={["LLM Usage", "Trace Telemetry", "Workflow Clustering", "Forge Recommendation", "Sandbox Verification", "Monitored Deployment"]} />
      </section>

      <section className="band compact-band">
        <div className="section-heading">
          <p className="eyebrow">Deployment Notes</p>
          <h2>Local-first today. Customer-controlled by design.</h2>
        </div>
        <div className="deployment-notes">
          <span>Local-first prototype today</span>
          <span>Self-hosted inside customer VPC</span>
          <span>Self-hosted evidence storage option</span>
          <span>Managed control plane option later</span>
          <span>Trust plane for tamper evidence</span>
        </div>
      </section>
    </main>
  );
}

function TraceDocumentation() {
  return (
    <main className="trace-page docs-page">
      <section className="docs-hero">
        <div>
          <div className="surface-badge product">
            <span>Trace Documentation</span>
            <strong>Local install and demo path</strong>
          </div>
          <h1>Run Trace locally and inspect agent evidence records.</h1>
          <p className="hero-text">
            Developer quickstart for installing the Trace prototype as a local data-plane service. Send an agent action, verify identity, evaluate policy posture, and receive a schema-valid evidence record.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={() => navigate(routes.demo)}>
              Request demo <ArrowRight size={18} />
            </button>
            <button className="secondary" onClick={() => navigate(routes.trace)}>
              Return to Trace
            </button>
          </div>
        </div>
        <div className="docs-redirect-panel">
          <BookOpenText size={28} />
          <strong>Install and start locally</strong>
          <code>npm run trace:install</code>
          <p>
            The bootstrap installs dependencies if needed, starts `http://localhost:8787`, and opens a local browser-friendly demo surface over the fixture and evaluation endpoints.
          </p>
        </div>
      </section>

      <section className="docs-grid" aria-label="Trace documentation areas">
        <DocsCard title="Clone and Run" text="Install the local Trace service and open a browser demo over bundled agent-event fixtures without a SaaS account." />
        <DocsCard title="Post Agent Events" text="Send structured tool-call JSON to `/trace/evaluate` with prompt, model, tool, resources, arguments, and destination metadata." />
        <DocsCard title="Switch Modes" text="Use `?mode=observe` to record violations without blocking, or `?mode=enforce` to return a standardized block response." />
        <DocsCard title="Inspect Evidence" text="Review the evaluation ledger, redacted argument preview, custody timestamps, deterministic hash, and signing stub." />
      </section>

      <section className="docs-band">
        <div className="section-heading">
          <p className="eyebrow">Quickstart</p>
          <h2>Bring up a local Trace data-plane demo in one bootstrap command.</h2>
          <p>
            This prototype is intentionally low-level and agentic-first. It should be easy to run on a developer machine now and straightforward to adapt later for enterprise package managers, endpoint management, CI runners, or customer VPC deployment.
          </p>
        </div>
        <div className="docs-command-stack">
          <code>git clone &lt;repository-url&gt;</code>
          <code>cd TraceV2</code>
          <code>npm run trace:install</code>
          <code>open http://localhost:8787/</code>
        </div>
        <div className="docs-steps">
          <DocsStep number="01" title="List fixtures" text="GET `/trace/fixtures` returns bundled agent events that can be replayed locally." />
          <DocsStep number="02" title="Run observe mode" text="POST `/trace/fixtures/payment-draft-above-threshold/run?mode=observe` returns a high-severity flag while allowing the action." />
          <DocsStep number="03" title="Run enforce mode" text="POST the same fixture with `?mode=enforce` to block the action and return a standardized agent error." />
          <DocsStep number="04" title="Post your own event" text="POST an agent tool-call JSON body to `/trace/evaluate?mode=observe` to test custom payloads." />
        </div>
      </section>

      <section className="docs-split">
        <div>
          <p className="eyebrow">Local Endpoints</p>
          <h2>The served prototype exposes just enough surface to test Trace behavior.</h2>
          <p>
            Use fixture endpoints for deterministic demos and `/trace/evaluate` for custom agent events. Every successful evaluation returns `agent_response` and `evidence_record`.
          </p>
        </div>
        <ol className="flow-list">
          <li><span>1</span> `GET /health` checks that the local Trace service is running.</li>
          <li><span>2</span> `GET /trace/fixtures` lists available fixture events.</li>
          <li><span>3</span> `POST /trace/fixtures/:fixture/run?mode=observe` replays a bundled fixture.</li>
          <li><span>4</span> `POST /trace/evaluate?mode=enforce` evaluates a custom event payload.</li>
        </ol>
      </section>

      <section className="docs-band compact-band">
        <div className="section-heading">
          <p className="eyebrow">Event Payload</p>
          <h2>Trace needs enough context to attribute, evaluate, and audit each agent action.</h2>
        </div>
        <div className="docs-grid dense">
          <DocsCard title="Identity" text="`agent_id`, organization, environment, owner, service-account mapping, allowed capabilities, scopes, and destinations." />
          <DocsCard title="Ingress" text="`request_id`, prompt, model provider, model name, model config, parent context, and received timestamp." />
          <DocsCard title="Action" text="Tool namespace, tool name, action, arguments, resources targeted, resources modified, and network destination." />
          <DocsCard title="Policy" text="Global mode, rule mode, threshold values, forbidden tools, hard interrupts, soft interrupts, and allowlists." />
        </div>
      </section>

      <section className="docs-split docs-split-reverse">
        <div>
          <p className="eyebrow">Expected Demo Result</p>
          <h2>The same payment action should prove observe and enforce behavior.</h2>
          <p>
            The bundled payment fixture attempts to create a $12,500 payment draft. Observe mode records a high-severity flag and allows the action. Enforce mode blocks the action and still emits evidence.
          </p>
        </div>
        <div className="docs-result-grid">
          <DocsResult label="Observe" result="flag" allowed="allowed" />
          <DocsResult label="Enforce" result="block" allowed="blocked" />
        </div>
      </section>
    </main>
  );
}

function DocsCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="docs-card">
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function DocsStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <article className="docs-step">
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </article>
  );
}

function DocsResult({ label, result, allowed }: { label: string; result: string; allowed: string }) {
  return (
    <article className="docs-result">
      <span>{label}</span>
      <strong>{result}</strong>
      <p>Action {allowed}; evidence record emitted.</p>
    </article>
  );
}

function TraceObject() {
  return (
    <div className="trace-object" aria-hidden="true">
      <div className="trace-orbit orbit-one" />
      <div className="trace-orbit orbit-two" />
      <div className="trace-prism">
        <span className="trace-plane plane-one" />
        <span className="trace-plane plane-two" />
        <span className="trace-plane plane-three" />
        <span className="trace-core-dot" />
      </div>
      <div className="trace-shadow" />
    </div>
  );
}

function RecursiveWorkflowVisual() {
  const { ref, isInView } = useScroll3D();
  const nodes = ["LLM", "Trace", "Cluster", "Forge", "Registry", "Deploy"];

  return (
    <div ref={ref} className={`recursive-workflow scroll-3d ${isInView ? "is-in-view" : ""}`} aria-hidden="true">
      <div className="workflow-glass">
        <div className="workflow-topline">
          <span>Automated workflow loop</span>
          <strong>live</strong>
        </div>
        <div className="workflow-node-grid">
          {nodes.map((node, index) => (
            <span key={node} style={{ "--i": index } as React.CSSProperties}>
              {node}
            </span>
          ))}
        </div>
        <div className="workflow-pulse-ring" />
      </div>
    </div>
  );
}

function ForgeObject() {
  const { ref, isInView } = useScroll3D();

  return (
    <div ref={ref} className={`forge-object scroll-3d ${isInView ? "is-in-view" : ""}`} aria-hidden="true">
      <div className="forge-plate plate-a" />
      <div className="forge-plate plate-b" />
      <div className="forge-plate plate-c" />
      <div className="forge-score">
        <span>primitive</span>
        <strong>94</strong>
      </div>
    </div>
  );
}

function ValuePill({ label, text }: { label: string; text: string }) {
  return (
    <article className="value-pill">
      <strong>{label}</strong>
      <span>{text}</span>
    </article>
  );
}

function ProofPoint({ value, label, source }: { value: string; label: string; source: string }) {
  return (
    <article className="proof-point">
      <strong>{value}</strong>
      <p>{label}</p>
      <small>{source}</small>
    </article>
  );
}

function SourceQuote({ quote, attribution }: { quote: string; attribution: string }) {
  return (
    <figure className="source-quote">
      <blockquote>{quote}</blockquote>
      <figcaption>{attribution}</figcaption>
    </figure>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ConsoleEvent({ id, system, status, detail }: { id: string; system: string; status: string; detail: string }) {
  return (
    <div className="console-event">
      <strong>{id}</strong>
      <span>{system}</span>
      <b>{status}</b>
      <small>{detail}</small>
    </div>
  );
}

function DemoRequest() {
  return (
    <main className="simple-page">
      <section className="contact-layout">
        <div>
          <p className="eyebrow">Request Demo</p>
          <h1>Bring Stria a workflow where AI needs a better record.</h1>
          <p className="page-lede">
            This demo request collects the information needed to scope a controlled Trace walkthrough around a real AI workflow. No tenant is provisioned automatically.
          </p>
          <div className="contact-notes">
            <StatusLine icon={<CheckCircle2 />} text="One target workflow with meaningful AI usage" />
            <StatusLine icon={<CheckCircle2 />} text="Known policy, review, or audit pressure" />
            <StatusLine icon={<CheckCircle2 />} text="A technical owner and an operational owner" />
          </div>
        </div>

        <form className="demo-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            Work email
            <input placeholder="name@company.com" />
          </label>
          <label>
            Organization
            <input placeholder="Company name" />
          </label>
          <label>
            Workflow to evaluate
            <textarea placeholder="Describe the AI workflow, users, and review pressure." />
          </label>
          <label>
            Current priority
            <select defaultValue="observability">
              <option value="observability">Interaction observability</option>
              <option value="evidence">Evidence and audit readiness</option>
              <option value="policy">Policy review and controls</option>
            </select>
          </label>
          <button type="submit" className="primary">
            Prepare demo request
          </button>
          <p className="form-note">
            Demo requests are prepared for review before onboarding.
          </p>
        </form>
      </section>
    </main>
  );
}

function StriaKineticScene() {
  const nodes = ["Trace", "Forge", "Trust", "Deploy", "Audit", "Learn"];

  return (
    <div className="stria-kinetic-scene" aria-hidden="true">
      <div className="kinetic-ring ring-one" />
      <div className="kinetic-ring ring-two" />
      <div className="kinetic-core">
        <span />
        <span />
        <span />
      </div>
      <div className="kinetic-nodes">
        {nodes.map((node, index) => (
          <span key={node} style={{ "--node": index } as React.CSSProperties}>
            {node}
          </span>
        ))}
      </div>
      <div className="kinetic-path path-one" />
      <div className="kinetic-path path-two" />
    </div>
  );
}

function SystemBackdrop() {
  return (
    <div className="system-backdrop" aria-hidden="true">
      <div className="signal-column left">
        <span />
        <span />
        <span />
      </div>
      <div className="signal-column right">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function TraceEvidenceVisual() {
  const { ref, isInView } = useScroll3D();

  return (
    <div ref={ref} className={`evidence-visual scroll-3d ${isInView ? "is-in-view" : ""}`} aria-label="Trace evidence record preview">
      <div className="visual-header">
        <span>Trace evidence record</span>
        <strong>Observe mode</strong>
      </div>
      <div className="record-stack">
        <VisualRow icon={<Database />} label="Interaction captured" value="Provider, model, tool context" tone="green" />
        <VisualRow icon={<Fingerprint />} label="Controls evaluated" value="PII boundary, data access, domain policy" tone="gold" />
        <VisualRow icon={<GitBranch />} label="Review path opened" value="Owner, rationale, evidence state" tone="stone" />
        <VisualRow icon={<LockKeyhole />} label="Audit material retained" value="Export-ready record" tone="red" />
      </div>
    </div>
  );
}

function OperatorCanvas() {
  const { ref, isInView } = useScroll3D();

  return (
    <div ref={ref} className={`operator-canvas scroll-3d ${isInView ? "is-in-view" : ""}`} aria-label="Trace operator copilot preview">
      <div className="canvas-alert">
        <span>Malicious LLM intent detected</span>
        <strong>Flagged - managed-ai-usage-review</strong>
        <p>Trace allowed the action in observe mode, preserved custody evidence, and routed the event for security review.</p>
      </div>
      <div className="canvas-chat">
        <div className="canvas-question">Why was this flagged?</div>
        <div className="canvas-answer">The query resembles unsafe credential theft. Trace linked the prompt hash, browser destination, policy rule, identity owner, and record hash.</div>
      </div>
      <div className="canvas-actions">
        <span>What evidence supports this?</span>
        <span>Who owns the agent?</span>
        <span>Would enforce mode block it?</span>
      </div>
    </div>
  );
}

function VisualRow({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className={`visual-row ${tone}`}>
      <div className="row-icon">{icon}</div>
      <div>
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
    </div>
  );
}

function InfoBlock({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="info-block">
      <div className="icon-box">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function Principle({ title, text }: { title: string; text: string }) {
  return (
    <article className="principle">
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function StatusLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="status-line">
      {icon}
      <span>{text}</span>
    </div>
  );
}

const rootEl = document.getElementById("root")!;
let root = (rootEl as any).__reactRoot;
if (!root) {
  root = createRoot(rootEl);
  (rootEl as any).__reactRoot = root;
}
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
