import styles from "./DocsCard.module.css";

interface DocsCardProps {
  title: string;
  text: string;
  icon?: React.ReactNode;
}

export function DocsCard({ title, text, icon }: DocsCardProps) {
  return (
    <article className={styles.card}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}