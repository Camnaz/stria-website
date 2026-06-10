import styles from "./TraceObject.module.css";

export function TraceObject() {
  return (
    <div className={styles.object} aria-hidden="true">
      <div className={styles.orbitOne} />
      <div className={styles.orbitTwo} />
      <div className={styles.prism}>
        <span className={styles.planeOne} />
        <span className={styles.planeTwo} />
        <span className={styles.planeThree} />
        <span className={styles.coreDot} />
      </div>
      <div className={styles.shadow} />
    </div>
  );
}