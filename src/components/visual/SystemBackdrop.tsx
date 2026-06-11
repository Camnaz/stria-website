import styles from "./SystemBackdrop.module.css";

interface SystemBackdropProps {
  className?: string;
}

export function SystemBackdrop({ className = "" }: SystemBackdropProps) {
  return (
    <div className={`${styles.backdrop} ${className}`} aria-hidden="true">
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