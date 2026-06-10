import { PrimitiveCard } from "./PrimitiveCard";
import type { ForgePrimitive, EvaluationRun, Deployment } from "../../types/platform";
import { evaluationRuns, deployments } from "../../data";
import styles from "./PrimitiveRegistry.module.css";

export function PrimitiveRegistry() {
  return (
    <div className={styles.panel}>
      <div className={styles.heading}>
        <span>Primitive registry</span>
        <strong>Approved automation is versioned, tested, scored, and deployable.</strong>
      </div>
      <div className={styles.list}>
        {Object.values(require("../../data/forgePrimitives").forgePrimitives).flat().map((primitive: ForgePrimitive) => {
          const evaluation = evaluationRuns.find((run) => run.primitive_id === primitive.id);
          const deployment = deployments.find((item) => item.primitive_id === primitive.id);
          return (
            <PrimitiveCard
              key={primitive.id}
              primitive={primitive}
              evaluation={evaluation}
              deployment={deployment}
            />
          );
        })}
      </div>
    </div>
  );
}