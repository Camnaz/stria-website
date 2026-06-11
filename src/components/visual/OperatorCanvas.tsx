import { useRef } from "react";
import { useScroll3D } from "../../hooks/useScrollAnimation";
import styles from "./OperatorCanvas.module.css";

export function OperatorCanvas() {
  const { ref, isInView } = useScroll3D();

  return (
    <div ref={ref} className={`${styles.canvas} ${styles.scroll3d} ${isInView ? "is-in-view" : ""}`} aria-label="Trace operator copilot preview">
      <div className={styles.alert}>
        <span>Malicious LLM intent detected</span>
        <strong>Flagged - managed-ai-usage-review</strong>
        <p>
          Trace allowed the action in observe mode, preserved custody evidence, and routed the event for security review.
        </p>
      </div>
      <div className={styles.chat}>
        <div className={styles.question}>Why was this flagged?</div>
        <div className={styles.answer}>
          The query resembles unsafe credential theft. Trace linked the prompt hash, browser destination, policy rule, identity owner, and record hash.
        </div>
      </div>
      <div className={styles.actions}>
        <span>What evidence supports this?</span>
        <span>Who owns the agent?</span>
        <span>Would enforce mode block it?</span>
      </div>
    </div>
  );
}