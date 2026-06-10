import styles from "./ProductCallout.module.css";
import { ModeColumn } from "../../components/common";
import type { ReactNode } from "react";

interface ProductCalloutProps {
  children: ReactNode;
  className?: string;
  eyebrow: string;
  title: string;
  text: string;
}

export function ProductCallout({ children, className = "", eyebrow, title, text }: ProductCalloutProps) {
  return (
    <section className={`${styles.callout} ${className}`}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <div className={styles.grid}>{children}</div>
    </section>
  );
}