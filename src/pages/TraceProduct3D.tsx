import { ThreeCanvas } from '../components/three';
import { Hero3D, Section3D, Band3D, Button3D } from '../components/three';
import { routes } from '../utils/navigation';
import { useNavigate } from 'react-router-dom';

export function TraceProduct3D() {
  const navigate = useNavigate();

  return (
    <ThreeCanvas sceneType="trace">
      <main className="page-3d">
        {/* Hero Section */}
        <Hero3D
          badge={{
            label: 'Usage intelligence → Evidence → Governance',
            title: 'Trace by Stria Systems',
          }}
          title='See every AI action. Prove every AI decision.'
          text='Trace captures prompts, outputs, tool calls, user behavior, latency, cost, failure modes, and compliance-relevant events so operators can understand AI usage before they automate or enforce.'
          bullets={[
            'Local agent install',
            'Operator copilot',
            'Evidence before enforcement',
          ]}
          actions={[
            <Button3D key="docs" variant="primary" onClick={() => navigate(routes.traceDocs)}>
              View developer prototype
            </Button3D>,
            <Button3D key="schema" variant="secondary" onClick={() => navigate(routes.traceDocs)}>
              Read the evidence schema
            </Button3D>,
          ]}
        />

        {/* Section: Trace Customer Value */}
        <Band3D>
          <Section3D
            eyebrow="TRACE CUSTOMER VALUE"
            title="Every AI action becomes attributable."
          >
            <div className="trace-value-strip-3d">
              <ValuePill3D label="Actions" text="Tool calls, resources, destinations, outcomes, and workflow state." />
              <ValuePill3D label="Authority" text="Agent identity, service accounts, allowed capabilities, and policy posture." />
              <ValuePill3D label="Accountability" text="Tamper-evident records, custody metadata, review paths, and intelligence reports." />
            </div>
          </Section3D>
        </Band3D>

        {/* Section: What Trace Does */}
        <Band3D>
          <Section3D
            eyebrow="What Trace Does"
            title="Every AI action becomes attributable."
            text="Trace sits in the execution path of AI agents and tool-using workflows. When an agent attempts an action, Trace checks who the agent is, what it is allowed to do, which policies apply, and what evidence must be retained."
          >
            <FlowDiagram3D steps={['Agent Action', 'Identity Verification', 'Policy Evaluation', 'Evidence Record', 'Hash / Chain of Custody', 'Operational Intelligence']} />
          </Section3D>
        </Band3D>

        {/* Section: Core Primitives */}
        <Band3D>
          <Section3D
            eyebrow="Core Primitives"
            title="The three primitives behind accountable AI execution."
          >
            <div className="three-col-3d">
              <PrimitiveCard3D
                title="Identity Manifests"
                items={[
                  'Agent identity binding',
                  'Human operator linkage',
                  'Delegation chain tracking',
                  'Credential rotation',
                ]}
              />
              <PrimitiveCard3D
                title="Policy Posture Specs"
                items={[
                  'Declarative policy as code',
                  'Context-aware conditions',
                  'Approval workflows',
                  'Versioned policy sets',
                ]}
              />
              <PrimitiveCard3D
                title="Evidence Records"
                items={[
                  'Cryptographic integrity',
                  'Selective disclosure',
                  'Audit log export',
                  'Long-term retention',
                ]}
              />
            </div>
          </Section3D>
        </Band3D>

        {/* Section: Trace Capabilities */}
        <Band3D>
          <Section3D
            eyebrow="TRACE CAPABILITIES"
            title="Built for the evidence lifecycle."
          >
            <div className="three-col-3d">
              <InfoBlock3D
                icon="search"
                title="Observe mode"
                text="Capture every prompt, output, tool call, and user action without blocking workflows. Flag risks, emit evidence."
              />
              <InfoBlock3D
                icon="shield"
                title="Enforce mode"
                text="Graduate rules to blocking. Return standardized errors to agents. Evidence still emitted for every decision."
              />
              <InfoBlock3D
                icon="network"
                title="Ingestion & replay"
                text="REST endpoints for agent events. Session replay with hash chaining. Analytics over stored usage."
              />
            </div>
          </Section3D>
        </Band3D>

        {/* Section: Deployment */}
        <Band3D>
          <Section3D
            eyebrow="DEPLOYMENT"
            title="Designed for enterprise data sovereignty."
          >
            <div className="three-col-3d">
              <InfoBlock3D
                icon="network"
                title="Data plane in your VPC"
                text="Telemetry ingestion, policy evaluation, and evidence persistence run inside your infrastructure."
              />
              <InfoBlock3D
                icon="git-branch"
                title="Control plane flexibility"
                text="Managed option later. Self-hosted today. Workflow clustering, primitive registry, deployment orchestration."
              />
              <InfoBlock3D
                icon="shield"
                title="Trust plane"
                text="Audit-ready export. Identity and authority management. No vendor lock-in on your evidence."
              />
            </div>
          </Section3D>
        </Band3D>
      </main>
    </ThreeCanvas>
  );
}

interface ValuePill3DProps {
  label: string;
  text: string;
}

function ValuePill3D({ label, text }: ValuePill3DProps) {
  return (
    <article className="value-pill-3d">
      <p className="value-pill-label-3d">{label}</p>
      <p className="value-pill-text-3d">{text}</p>
    </article>
  );
}

interface FlowDiagram3DProps {
  steps: string[];
}

function FlowDiagram3D({ steps }: FlowDiagram3DProps) {
  return (
    <div className="flow-diagram-3d">
      {steps.map((step, i) => (
        <div key={step} className="flow-step-3d">
          <span className="flow-step-text-3d">{step}</span>
          {i < steps.length - 1 && <span className="flow-arrow-3d" aria-hidden="true">→</span>}
        </div>
      ))}
    </div>
  );
}

interface PrimitiveCard3DProps {
  title: string;
  items: string[];
}

function PrimitiveCard3D({ title, items }: PrimitiveCard3DProps) {
  return (
    <article className="primitive-card-3d">
      <h3 className="primitive-card-title-3d">{title}</h3>
      <ul className="primitive-card-list-3d">
        {items.map((item) => (
          <li key={item} className="primitive-card-item-3d">
            <span className="primitive-card-bullet-3d" aria-hidden="true">▸</span>
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}

// Re-export InfoBlock3D for use in this file
function InfoBlock3D({ icon, title, text }: { icon: string; title: string; text: string }) {
  const icons: Record<string, string> = {
    network: '⬢',
    shield: '⬡',
    clipboard: '☐',
    search: '◎',
    'git-branch': '⎇',
    database: '⌂',
  };

  return (
    <article className="info-block-3d">
      <div className="info-block-icon-3d" aria-hidden="true">{icons[icon]}</div>
      <h3 className="info-block-title-3d">{title}</h3>
      <p className="info-block-text-3d">{text}</p>
    </article>
  );
}