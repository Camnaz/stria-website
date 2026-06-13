import styles from "./ClosingCTA.module.css";
import type { ReactNode } from "react";

interface ClosingCTAProps {
  eyebrow: string;
  title: string;
  text: string;
  action: ReactNode;
  className?: string;
}

export function ClosingCTA({ eyebrow: _eyebrow, title, text, action, className = "" }: ClosingCTAProps) {
  return (
    <section className={`${styles.cta} ${className}`}>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className={styles.action}>{action}</div>
    </section>
  );
}
