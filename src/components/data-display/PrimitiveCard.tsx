import { MetricTile, StatusPill } from "../ui";
import type { ForgePrimitive, EvaluationRun, Deployment } from "../../types/platform";
import { scorePrimitive } from "../../types/platform";
import styles from "./PrimitiveCard.module.css";

interface PrimitiveCardProps {
  primitive: ForgePrimitive;
  evaluation: EvaluationRun | undefined;
  deployment: Deployment | undefined;
}

export function PrimitiveCard({ primitive, evaluation, deployment }: PrimitiveCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.title}>
        <div>
          <span>{primitive.id}</span>
          <h3>{primitive.name}</h3>
        </div>
        <StatusPill variant={primitive.status}>{primitive.status}</StatusPill>
      </div>
      <p>{primitive.description}</p>
      <div className={styles.metrics}>
        <MetricTile label="Version" value={primitive.version} />
        <MetricTile label="Score" value={String(scorePrimitive(primitive))} />
        <MetricTile
          label="Tests"
          value={evaluation ? `${evaluation.tests_passed}/${evaluation.tests_passed + evaluation.tests_failed}` : "not run"}
        />
        <MetricTile label="Deploy" value={deployment ? deployment.environment : "none"} />
      </div>
    </article>
  );
}