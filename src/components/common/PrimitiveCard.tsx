import styles from "./PrimitiveCard.module.css";
import type { ForgePrimitive } from "../../striaPlatformData";

interface PrimitiveCardProps {
  title: string;
  items: string[];
}

export function PrimitiveCard({ title, items }: PrimitiveCardProps) {
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