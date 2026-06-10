import styles from "./ArchitectureCard.module.css";

interface ArchitectureCardProps {
  title: string;
  items: string[];
}

export function ArchitectureCard({ title, items }: ArchitectureCardProps) {
  return (
    <article className={styles.card}>
      <h3>{title}</h3>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </article>
  );
}