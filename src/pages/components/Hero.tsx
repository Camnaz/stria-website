import styles from "./Hero.module.css";
import type { ReactNode } from "react";

interface HeroBadge {
  label: string;
  title: string;
}

interface HeroProps {
  children?: ReactNode;
  className?: string;
  badge: HeroBadge;
  title: string;
  text: string;
  bullets?: string[];
  actions?: ReactNode[];
}

export function Hero({ children, className = "", badge, title, text, bullets, actions }: HeroProps) {
  return (
    <section className={`${styles.hero} ${className}`}>
      <div className={styles.content}>
        <div className={styles.badge}>
          <span>{badge.label}</span>
          <strong>{badge.title}</strong>
        </div>
        <h1>{title}</h1>
        <p className={styles.text}>{text}</p>
        {bullets && bullets.length > 0 && (
          <ul className={styles.bullets} aria-label="Capabilities">
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        )}
        {actions && actions.length > 0 && (
          <div className={styles.actions}>{actions}</div>
        )}
      </div>
      {children}
    </section>
  );
}