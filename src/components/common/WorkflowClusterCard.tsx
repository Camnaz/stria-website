import styles from "./WorkflowClusterCard.module.css";
import type { WorkflowCluster } from "../../striaPlatformData";

interface WorkflowClusterCardProps {
  cluster: WorkflowCluster;
  compact?: boolean;
}

export function WorkflowClusterCard({ cluster, compact = false }: WorkflowClusterCardProps) {
  return (
    <article className={`${styles.card} ${compact ? styles.compact : ""}`}>
      <div className={styles.header}>
        <h3>{cluster.name}</h3>
        <span className={`${styles.badge} ${cluster.recommended_for_forge ? styles.forge : ""}`}>
          {cluster.recommended_for_forge ? "Forge Candidate" : "Observed"}
        </span>
      </div>
      <p className={styles.description}>{cluster.description}</p>
      <dl className={styles.stats}>
        <dt>Frequency</dt>
        <dd>{cluster.frequency}</dd>
        <dt>Automation Score</dt>
        <dd>{cluster.automation_score}/100</dd>
        <dt>Avg Cost</dt>
        <dd>${cluster.avg_cost.toFixed(3)}</dd>
        <dt>Avg Latency</dt>
        <dd>{cluster.avg_latency}ms</dd>
        <dt>Failure Rate</dt>
        <dd>{(cluster.failure_rate * 100).toFixed(1)}%</dd>
      </dl>
    </article>
  );
}