import styles from "./SystemBackdrop.module.css";

export function SystemBackdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.signalColumnLeft}>
        <span />
        <span />
        <span />
      </div>
      <div className={styles.signalColumnRight}>
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}