import styles from "./DocsCard.module.css";

interface DocsCardProps {
  title: string;
  text: string;
}

export function DocsCard({ title, text }: DocsCardProps) {
  return (
    <article className={styles.card}>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}