import { ArrowRight, ClipboardCheck, GitBranch, Network, ShieldCheck } from "lucide-react";
import { Band, Hero, ProductCallout, SectionHeading, ThreeCol } from "./components";
import { SystemBackdrop, StriaKineticScene } from "../components/visual";
import { InfoBlock, WorkflowClusterCard, PrimitiveCard } from "../components/common";
import { Button } from "../components/ui";
import { routes } from "../utils/navigation";
import { useNavigate } from "react-router-dom";
import { workflowClusters, forgePrimitives, deployments } from "../striaPlatformData";
import styles from "./ForgeProduct.module.css";

export function ForgeProduct() {
  const navigate = useNavigate();
  return (
    <main className={styles.page}>
      <Hero
        className={styles.hero}
        badge={{
          label: "Workflow clustering → Verification → Registry",
          title: "Forge by Stria Systems",
        }}
        title="When AI work repeats, forge it into infrastructure."
        text="Forge does not replace agents. It gives repeated agent work a tested execution path — with sandbox verification, scoring, versioning, and deployment feedback."
        actions={[
          <Button key="platform" variant="primary" onClick={() => navigate(routes.platform)}>
            View platform dashboard <ArrowRight size={18} />
          </Button>,
          <Button key="trace" variant="secondary" onClick={() => navigate(routes.trace)}>
            See Trace telemetry
          </Button>,
        ]}
      >
        <SystemBackdrop />
        <StriaKineticScene className={styles.kineticScene} />
      </Hero>

      <Band className={styles.band}>
        <SectionHeading eyebrow="FORGE BOUNDARY" title="Forge does not replace agents. It gives repeated agent work a tested execution path." />
        <ThreeCol>
          <InfoBlock
            icon={<ClipboardCheck />}
            title="Recommendation"
            text="Trace clusters repeated workflows and scores them for automation readiness."
          />
          <InfoBlock
            icon={<ShieldCheck />}
            title="Verification"
            text="Sandbox execution with deterministic tests, scoring, and regression detection."
          />
          <InfoBlock
            icon={<GitBranch />}
            title="Registry"
            text="Approved primitives are versioned, tested, scored, and deployable with metadata."
          />
        </ThreeCol>
      </Band>

      <Band className={`${styles.band} ${styles.splitBand}`}>
        <div className={styles.splitLeft}>
          <p className={styles.eyebrow}>CANDIDATE WORKFLOWS</p>
          <strong>Identified from Trace telemetry, scored for automation readiness.</strong>
          {workflowClusters.map((cluster) => (
            <WorkflowClusterCard key={cluster.id} cluster={cluster} compact />
          ))}
        </div>
        <div className={styles.splitRight}>
          <p className={styles.eyebrow}>PRIMITIVE REGISTRY</p>
          <strong>Approved automation is versioned, tested, scored, and deployable.</strong>
          {forgePrimitives.map((primitive) => {
            const deployment = deployments.find((d) => d.primitive_id === primitive.id);
            return (
              <PrimitiveCard key={primitive.id} title={primitive.name} items={[
                `Version ${primitive.version}`,
                `Status: ${primitive.status}`,
                `Score: ${Math.round(primitive.performance_profile.correctness * 100)}`,
                `Tests: ${primitive.test_suite.length} passing`,
                `Deploy: ${deployment?.environment || "staging"}`,
              ]} />
            );
          })}
        </div>
      </Band>

      <Band className={`${styles.band} ${styles.splitBand}`}>
        <div className={styles.splitLeft}>
          <p className={styles.eyebrow}>SANDBOX EXECUTION</p>
          <strong>Verified primitives run in isolated environments with deterministic I/O.</strong>
          <pre className={styles.codeBlock}>{`POST /forge/workflow-candidates
{
  "workflow_cluster_id": "wf_refund_exception",
  "source": "trace",
  "score_threshold": 85
}

POST /forge/primitives/:id/evaluate
POST /forge/primitives/:id/deploy
GET  /trace/events?primitive_id={primitiveId}`}</pre>
        </div>
        <div className={styles.splitRight}>
          <p className={styles.eyebrow}>CLEAN API BOUNDARY</p>
          <strong>Trace remains the source of truth. Forge reads telemetry, writes primitives.</strong>
          <ul className={styles.apiList}>
            <li>Trace → Forge: workflow candidate events</li>
            <li>Forge → Trace: primitive execution telemetry</li>
            <li>Bidirectional: deployment feedback loop</li>
          </ul>
        </div>
      </Band>
    </main>
  );
}
