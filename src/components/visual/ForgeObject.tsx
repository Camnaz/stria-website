import { useRef } from "react";
import { useScroll3D } from "../../hooks/useScrollAnimation";
import styles from "./ForgeObject.module.css";

export function ForgeObject() {
  const { ref, isInView } = useScroll3D();

  return (
    <div ref={ref} className={`${styles.object} ${styles.scroll3d} ${isInView ? "is-in-view" : ""}`} aria-hidden="true">
      <div className={`${styles.plate} ${styles.plateA}`} />
      <div className={`${styles.plate} ${styles.plateB}`} />
      <div className={`${styles.plate} ${styles.plateC}`} />
      <div className={styles.score}>
        <span>primitive</span>
        <strong>94</strong>
      </div>
    </div>
  );
}