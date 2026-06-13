import { ThreeCanvas } from '../components/three';
import { Hero3D, Section3D, Band3D, Button3D } from '../components/three';
import { routes } from '../utils/navigation';
import { useNavigate } from 'react-router-dom';

export function CompanyHome3D() {
  const navigate = useNavigate();

  return (
    <ThreeCanvas sceneType="home">
      <main className="page-3d">
        {/* Hero Section */}
        <Hero3D
          badge={{
            label: 'Stria Systems',
            title: 'The evidence layer for enterprise AI',
          }}
          title='AI is doing the work. Stria proves it did it right.'
          text='Every prompt, tool call, and automated action leaves a trail. Stria turns that trail into evidence --- then the work that repeats into verified execution infrastructure.'
          bullets={[
            'Trace LLM usage, tool calls, cost, and failures',
            'Cluster repeated workflows from telemetry',
            'Verify deterministic primitives before deployment',
          ]}
          actions={[
            <Button3D key="platform" variant="primary" onClick={() => navigate(routes.platform)}>
              View platform
            </Button3D>,
            <Button3D key="forge" variant="secondary" onClick={() => navigate(routes.forge)}>
              Explore Forge
            </Button3D>,
          ]}
        />

        {/* Section: Execution Accountability */}
        <Band3D>
          <Section3D
            eyebrow="Execution Accountability"
            title="Evidence that survives audit scrutiny."
          >
            <div className="three-col-3d">
              <InfoBlock3D
                icon="network"
                title="Beyond model calls"
                text="Existing observability focuses on logs and traces. Stria focuses on delegated execution and accountable action."
              />
              <InfoBlock3D
                icon="shield"
                title="Beyond prompt review"
                text="Governance often stops at prompts and outputs. Stria tracks the authority, policy, and workflow state behind every action."
              />
              <InfoBlock3D
                icon="clipboard"
                title="Low-friction controls"
                text="A consistent policy and evidence layer that works without rewriting every agent workflow from scratch."
              />
            </div>
          </Section3D>
        </Band3D>

        {/* Section: The Stria Approach */}
        <Band3D variant="callout">
          <Section3D
            eyebrow="The Stria Approach"
            title="Evidence before enforcement."
            text="Capture evidence first, then enforce. Trace runs in observe mode to build a baseline, then graduates rules to enforce mode once teams understand production patterns."
          >
            <div className="mode-grid-3d">
              <ModeColumn3D
                title="Observe mode"
                items={['capture action', 'evaluate policy', 'flag risk', 'allow workflow to continue', 'emit evidence']}
              />
              <ModeColumn3D
                title="Enforce mode"
                items={['capture action', 'evaluate policy', 'block violations', 'return standardized error', 'emit evidence']}
              />
            </div>
          </Section3D>
        </Band3D>

        {/* Section: Platform Products */}
        <Band3D>
          <Section3D
            eyebrow="Platform Products"
            title="Trace observes. Forge verifies."
          >
            <div className="three-col-3d">
              <InfoBlock3D
                icon="search"
                title="Stria Trace"
                text="Observe, attribute, and audit LLM usage across prompts, outputs, tools, cost, latency, and compliance events."
              />
              <InfoBlock3D
                icon="git-branch"
                title="Stria Forge"
                text="Turn repeated AI workflows into verified execution primitives with tests, scoring, registry metadata, and deployment feedback."
              />
              <InfoBlock3D
                icon="database"
                title="Shared data layer"
                text="Organizations, traces, workflow clusters, primitives, evaluations, deployments, and authentication under one platform."
              />
            </div>
            <div className="section-actions-3d">
              <Button3D variant="primary" onClick={() => navigate(routes.platform)}>
                View platform dashboard
              </Button3D>
            </div>
          </Section3D>
        </Band3D>

        {/* Section: Audience */}
        <Band3D variant="compact">
          <Section3D
            eyebrow="Audience"
            title="Built for the teams responsible for AI risk."
          >
            <div className="audience-grid-3d">
              <Principle3D title="CISO" text="Know which agents acted, what they touched, and whether they violated policy." />
              <Principle3D title="General Counsel" text="Retain audit-ready evidence for AI-driven business actions." />
              <Principle3D title="AI Platform Teams" text="Route agent execution through a consistent identity, policy, and evidence layer." />
              <Principle3D title="Compliance" text="Map actions, approvals, and outcomes to control evidence." />
              <Principle3D title="Operations" text="Find workflow delays, review bottlenecks, and over-restrictive policies." />
            </div>
          </Section3D>
        </Band3D>

        {/* Closing CTA */}
        <Band3D variant="cta">
          <Section3D
            eyebrow="Accountable Autonomy"
            title="Delegate the work. Keep the receipts."
            text="The next decade of work runs on delegated authority. Stria is the layer that lets enterprises hand real work to autonomous systems --- and prove, at any moment, exactly what happened."
          >
            <Button3D variant="primary" onClick={() => navigate(routes.trace)}>
              Explore Trace
            </Button3D>
          </Section3D>
        </Band3D>
      </main>
    </ThreeCanvas>
  );
}

// 3D-optimized component implementations
interface InfoBlock3DProps {
  icon: 'network' | 'shield' | 'clipboard' | 'search' | 'git-branch' | 'database';
  title: string;
  text: string;
}

function InfoBlock3D({ icon, title, text }: InfoBlock3DProps) {
  const icons: Record<string, string> = {
    network: '-¨¢',
    shield: '-¨°',
    clipboard: '-òê',
    search: '-óé',
    'git-branch': '-éá',
    database: '-åÇ',
  };

  return (
    <article className="info-block-3d">
      <div className="info-block-icon-3d" aria-hidden="true">{icons[icon]}</div>
      <h3 className="info-block-title-3d">{title}</h3>
      <p className="info-block-text-3d">{text}</p>
    </article>
  );
}

interface ModeColumn3DProps {
  title: string;
  items: string[];
}

function ModeColumn3D({ title, items }: ModeColumn3DProps) {
  return (
    <article className="mode-column-3d">
      <h3 className="mode-column-title-3d">{title}</h3>
      <ul className="mode-column-list-3d">
        {items.map((item) => (
          <li key={item} className="mode-column-item-3d">
            <span className="mode-column-bullet-3d" aria-hidden="true">-ñ∏</span>
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}

interface Principle3DProps {
  title: string;
  text: string;
}

function Principle3D({ title, text }: Principle3DProps) {
  return (
    <article className="principle-3d">
      <h3 className="principle-title-3d">{title}</h3>
      <p className="principle-text-3d">{text}</p>
    </article>
  );
}

// CSS for 3D page components (will be imported via styles)