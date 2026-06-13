import { ThreeCanvas } from '../components/three';
import { Hero3D, Section3D, Band3D, Button3D } from '../components/three';
import { routes } from '../utils/navigation';
import { useNavigate } from 'react-router-dom';
import { workflowClusters, forgePrimitives, deployments } from '../striaPlatformData';

export function ForgeProduct3D() {
  const navigate = useNavigate();

  return (
    <ThreeCanvas sceneType="forge">
      <main className="page-3d">
        {/* Hero Section */}
        <Hero3D
          badge={{
            label: 'Workflow clustering -Üí Verification -Üí Registry',
            title: 'Forge by Stria Systems',
          }}
          title='When AI work repeats, forge it into infrastructure.'
          text="Forge does not replace agents. It gives repeated agent work a tested execution path --- with sandbox verification, scoring, versioning, and deployment feedback."
          bullets={[]}
          actions={[
            <Button3D key="platform" variant="primary" onClick={() => navigate(routes.platform)}>
              View platform dashboard
            </Button3D>,
            <Button3D key="trace" variant="secondary" onClick={() => navigate(routes.trace)}>
              See Trace telemetry
            </Button3D>,
          ]}
        />

        {/* Section: Forge Boundary */}
        <Band3D>
          <Section3D
            eyebrow="FORGE BOUNDARY"
            title="Forge does not replace agents. It gives repeated agent work a tested execution path."
          >
            <div className="three-col-3d">
              <InfoBlock3D
                icon="clipboard"
                title="Recommendation"
                text="Trace clusters repeated workflows and scores them for automation readiness."
              />
              <InfoBlock3D
                icon="shield"
                title="Verification"
                text="Sandbox execution with deterministic tests, scoring, and regression detection."
              />
              <InfoBlock3D
                icon="git-branch"
                title="Registry"
                text="Approved primitives are versioned, tested, scored, and deployable with metadata."
              />
            </div>
          </Section3D>
        </Band3D>

        {/* Section: Candidate Workflows & Primitive Registry */}
        <Band3D variant="callout">
          <Section3D
            eyebrow="CANDIDATE WORKFLOWS / PRIMITIVE REGISTRY"
            title="From Trace telemetry to verified automation."
          >
            <div className="forge-split-3d">
              <div className="forge-split-left-3d">
                <p className="forge-eyebrow-3d">CANDIDATE WORKFLOWS</p>
                <strong className="forge-lead-3d">Identified from Trace telemetry, scored for automation readiness.</strong>
                <div className="forge-cluster-list-3d">
                  {workflowClusters.map((cluster) => (
                    <WorkflowClusterCard3D key={cluster.id} cluster={cluster} />
                  ))}
                </div>
              </div>
              <div className="forge-split-right-3d">
                <p className="forge-eyebrow-3d">PRIMITIVE REGISTRY</p>
                <strong className="forge-lead-3d">Approved automation is versioned, tested, scored, and deployable.</strong>
                <div className="forge-primitive-list-3d">
                  {forgePrimitives.map((primitive) => {
                    const deployment = deployments.find((d) => d.primitive_id === primitive.id);
                    return (
                      <PrimitiveCard3D key={primitive.id} title={primitive.name} items={[
                        `Version ${primitive.version}`,
                        `Status: ${primitive.status}`,
                        `Score: ${Math.round(primitive.performance_profile.correctness * 100)}`,
                        `Tests: ${primitive.test_suite.length} passing`,
                        `Deploy: ${deployment?.environment || 'staging'}`,
                      ]} />
                    );
                  })}
                </div>
              </div>
            </div>
          </Section3D>
        </Band3D>

        {/* Section: Sandbox Execution & API Boundary */}
        <Band3D>
          <Section3D
            eyebrow="SANDBOX EXECUTION / CLEAN API BOUNDARY"
            title="Verified primitives run in isolated environments. Trace remains the source of truth."
          >
            <div className="forge-split-3d">
              <div className="forge-split-left-3d">
                <p className="forge-eyebrow-3d">SANDBOX EXECUTION</p>
                <strong className="forge-lead-3d">Verified primitives run in isolated environments with deterministic I/O.</strong>
                <pre className="forge-code-3d">{`POST /forge/workflow-candidates
{
  "workflow_cluster_id": "wf_refund_exception",
  "source": "trace",
  "score_threshold": 85
}

POST /forge/primitives/:id/evaluate
POST /forge/primitives/:id/deploy
GET  /trace/events?primitive_id={primitiveId}`}</pre>
              </div>
              <div className="forge-split-right-3d">
                <p className="forge-eyebrow-3d">CLEAN API BOUNDARY</p>
                <strong className="forge-lead-3d">Trace -Üí Forge: workflow candidate events. Forge -Üí Trace: primitive execution telemetry.</strong>
                <ul className="forge-api-list-3d">
                  <li>Trace -Üí Forge: workflow candidate events</li>
                  <li>Forge -Üí Trace: primitive execution telemetry</li>
                  <li>Bidirectional: deployment feedback loop</li>
                </ul>
              </div>
            </div>
          </Section3D>
        </Band3D>
      </main>
    </ThreeCanvas>
  );
}

interface WorkflowClusterCard3DProps {
  cluster: typeof workflowClusters[0];
}

function WorkflowClusterCard3D({ cluster }: WorkflowClusterCard3DProps) {
  return (
    <article className="workflow-cluster-card-3d">
      <div className="cluster-header-3d">
        <h4 className="cluster-title-3d">{cluster.name}</h4>
        <span className="cluster-score-3d">{cluster.automation_score}%</span>
      </div>
      <p className="cluster-desc-3d">{cluster.description}</p>
      <div className="cluster-meta-3d">
        <span className="cluster-meta-item-3d">Events: {cluster.event_count}</span>
        <span className="cluster-meta-item-3d">Agents: {cluster.unique_agents}</span>
        <span className="cluster-meta-item-3d">Cost: ${cluster.total_cost.toFixed(2)}</span>
      </div>
    </article>
  );
}

interface PrimitiveCard3DProps {
  title: string;
  items: string[];
}

function PrimitiveCard3D({ title, items }: PrimitiveCard3DProps) {
  return (
    <article className="primitive-card-3d">
      <h4 className="primitive-card-title-3d">{title}</h4>
      <ul className="primitive-card-list-3d">
        {items.map((item) => (
          <li key={item} className="primitive-card-item-3d">
            <span className="primitive-card-bullet-3d" aria-hidden="true">-ñ∏</span>
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