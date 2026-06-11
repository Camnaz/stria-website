import styles from "./InfoBlock.module.css";

interface InfoBlockProps {
  icon: React.ReactNode;
  title: string;
  text: string;
}

export function InfoBlock({ icon, title, text }: InfoBlockProps) {
  return (
    <article className={styles.block}>
      <div className={styles.iconBox}>{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}