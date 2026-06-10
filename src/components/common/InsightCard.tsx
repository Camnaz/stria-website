import styles from "./InsightCard.module.css";

interface InsightCardProps {
  title: string;
  text: string;
}

export function InsightCard({ title, text }: InsightCardProps) {
  return (
    <article className={styles.card}>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}