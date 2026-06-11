import styles from "./StriaKineticScene.module.css";
import type { CSSProperties } from "react";

const nodes = ["Trace", "Forge", "Trust", "Deploy", "Audit", "Learn"];

interface StriaKineticSceneProps {
  className?: string;
}

export function StriaKineticScene({ className = "" }: StriaKineticSceneProps) {
  return (
    <div className={`${styles.scene} ${className}`} aria-hidden="true">
      <div className={styles.ringOne} />
      <div className={styles.ringTwo} />
      <div className={styles.core}>
        <span />
        <span />
        <span />
      </div>
      <div className={styles.nodes}>
        {nodes.map((node, index) => (
          <span key={node} style={{ "--node": index } as CSSProperties}>
            {node}
          </span>
        ))}
      </div>
      <div className={styles.pathOne} />
      <div className={styles.pathTwo} />
    </div>
  );
}