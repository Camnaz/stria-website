import styles from "./ValueCard.module.css";

interface ValueCardProps {
  icon: React.ReactNode;
  title: string;
  text: string;
}

export function ValueCard({ icon, title, text }: ValueCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.icon}>{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}