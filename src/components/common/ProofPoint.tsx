import styles from "./ProofPoint.module.css";

interface ProofPointProps {
  value: string;
  label: string;
  source: string;
}

export function ProofPoint({ value, label, source }: ProofPointProps) {
  return (
    <article className={styles.proofPoint}>
      <strong>{value}</strong>
      <p>{label}</p>
      <small>{source}</small>
    </article>
  );
}