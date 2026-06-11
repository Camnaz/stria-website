import { MetricTile } from "../ui";
import type { WorkflowCluster } from "../../types/platform";
import styles from "./WorkflowClusterCard.module.css";

interface WorkflowClusterCardProps {
  cluster: WorkflowCluster;
}

export function WorkflowClusterCard({ cluster }: WorkflowClusterCardProps) {
  return (
    <article className={`${styles.card} ${cluster.recommended_for_forge ? styles.recommended : ""}`}>
      <div>
        <span>{cluster.id}</span>
        <h3>{cluster.name}</h3>
        <p>{cluster.description}</p>
      </div>
      <div className={styles.metrics}>
        <MetricTile label="Frequency" value={String(cluster.frequency)} />
        <MetricTile label="Avg cost" value={`$${cluster.avg_cost.toFixed(3)}`} />
        <MetricTile label="Failure" value={`${Math.round(cluster.failure_rate * 100)}%`} />
        <MetricTile label="Forge score" value={String(cluster.automation_score)} />
      </div>
      <strong>{cluster.recommended_for_forge ? "Recommended for Forge" : "Keep observing"}</strong>
    </article>
  );
}