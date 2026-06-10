import styles from "./MetricTile.module.css";

export interface MetricTileProps {
  label: string;
  value: string;
}

export function MetricTile({ label, value }: MetricTileProps) {
  return (
    <article className={styles.metricTile}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}