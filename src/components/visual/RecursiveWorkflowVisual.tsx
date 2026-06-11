import { useRef } from "react";
import { useScroll3D } from "../../hooks/useScrollAnimation";
import styles from "./RecursiveWorkflowVisual.module.css";

const nodes = ["LLM", "Trace", "Cluster", "Forge", "Registry", "Deploy"];

interface RecursiveWorkflowVisualProps {
  className?: string;
}

export function RecursiveWorkflowVisual({ className = "" }: RecursiveWorkflowVisualProps) {
  const { ref, isInView } = useScroll3D();

  return (
    <div ref={ref} className={`${styles.visual} ${styles.scroll3d} ${className} ${isInView ? "is-in-view" : ""}`} aria-hidden="true">
      <div className={styles.glass}>
        <div className={styles.topline}>
          <span>Automated workflow loop</span>
          <strong>live</strong>
        </div>
        <div className={styles.nodeGrid}>
          {nodes.map((node, index) => (
            <span key={node} style={{ "--i": index } as React.CSSProperties}>
              {node}
            </span>
          ))}
        </div>
        <div className={styles.pulseRing} />
      </div>
    </div>
  );
}