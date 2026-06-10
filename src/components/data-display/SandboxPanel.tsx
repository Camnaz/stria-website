import styles from "./SandboxPanel.module.css";

export function SandboxPanel() {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeading}>
        <span>SANDBOX</span>
        <strong>Verified primitives execute in isolation with deterministic I/O contracts.</strong>
      </div>
      <pre className={styles.codeBlock}>{`POST /forge/workflow-candidates
{
  "workflow_cluster_id": "wf_refund_exception",
  "source": "trace",
  "score_threshold": 85
}

POST /forge/primitives/:id/evaluate
POST /forge/primitives/:id/deploy
GET  /trace/events?primitive_id=...`}</pre>
    </div>
  );
}