import styles from "./StriaKineticScene.module.css";

const nodes = ["Trace", "Forge", "Trust", "Deploy", "Audit", "Learn"];

export function StriaKineticScene() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.ringOne} />
      <div className={styles.ringTwo} />
      <div className={styles.core}>
        <span />
        <span />
        <span />
      </div>
      <div className={styles.nodes}>
        {nodes.map((node, index) => (
          <span key={node} style={{ "--node": index } as React.CSSProperties}>
            {node}
          </span>
        ))}
      </div>
      <div className={styles.pathOne} />
      <div className={styles.pathTwo} />
    </div>
  );
}