import styles from "./Band.module.css";
import type { ReactNode } from "react";

interface BandProps {
  children: ReactNode;
  className?: string;
}

export function Band({ children, className = "" }: BandProps) {
  return (
    <section className={`${styles.band} ${className}`}>
      {children}
    </section>
  );
}