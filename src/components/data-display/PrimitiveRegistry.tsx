import { forgePrimitives, deployments } from "../../striaPlatformData";
import styles from "./PrimitiveRegistry.module.css";

export function PrimitiveRegistry() {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeading}>
        <span>PRIMITIVE REGISTRY</span>
        <strong>Approved automation is versioned, tested, scored, and deployable.</strong>
      </div>
      {forgePrimitives.map((primitive) => {
        const deployment = deployments.find((d) => d.primitive_id === primitive.id);
        return (
          <article key={primitive.id} className={styles.primitiveItem}>
            <code>{primitive.id}</code>
            <h3>{primitive.name}</h3>
            <span className={`${styles.statusBadge} ${styles[primitive.status]}`}>{primitive.status.toUpperCase()}</span>
            <p>{primitive.description}</p>
            <div className={styles.primitiveMeta}>
              <div><span>VERSION</span><strong>{primitive.version}</strong></div>
              <div><span>SCORE</span><strong>{(primitive.performance_profile.correctness * 100 | 0)}</strong></div>
              <div><span>TESTS</span><strong>{primitive.test_suite.length} passing</strong></div>
              <div><span>DEPLOY</span><strong>{deployment?.environment || "staging"}</strong></div>
            </div>
          </article>
        );
      })}
    </div>
  );
}