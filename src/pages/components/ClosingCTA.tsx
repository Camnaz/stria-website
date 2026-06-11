import styles from "./ClosingCTA.module.css";
import type { ReactNode } from "react";

interface ClosingCTAProps {
  eyebrow: string;
  title: string;
  text: string;
  action: ReactNode;
  className?: string;
}

export function ClosingCTA({ eyebrow, title, text, action, className = "" }: ClosingCTAProps) {
  return (
    <section className={`${styles.cta} ${className}`}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className={styles.action}>{action}</div>
    </section>
  );
}