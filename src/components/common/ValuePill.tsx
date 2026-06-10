import styles from "./ValuePill.module.css";

interface ValuePillProps {
  label: string;
  text: string;
}

export function ValuePill({ label, text }: ValuePillProps) {
  return (
    <article className={styles.pill}>
      <strong>{label}</strong>
      <span>{text}</span>
    </article>
  );
}