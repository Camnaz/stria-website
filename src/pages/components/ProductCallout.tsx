import styles from "./ProductCallout.module.css";
import type { ReactNode } from "react";

interface ProductCalloutProps {
  children: ReactNode;
  className?: string;
  eyebrow: string;
  title: string;
  text: string;
}

export function ProductCallout({ children, className = "", eyebrow: _eyebrow, title, text }: ProductCalloutProps) {
  return (
    <section className={`${styles.callout} ${className}`}>
      <div className={styles.copy}>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <div className={styles.grid}>{children}</div>
    </section>
  );
}
