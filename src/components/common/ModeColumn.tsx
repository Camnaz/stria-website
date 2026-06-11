import styles from "./ModeColumn.module.css";

interface ModeColumnProps {
  title: string;
  items: string[];
}

export function ModeColumn({ title, items }: ModeColumnProps) {
  return (
    <article className={styles.column}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}