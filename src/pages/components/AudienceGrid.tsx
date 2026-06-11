import styles from "./AudienceGrid.module.css";
import type { ReactNode } from "react";

interface AudienceGridProps {
  children: ReactNode;
  className?: string;
}

export function AudienceGrid({ children, className = "" }: AudienceGridProps) {
  return (
    <div className={`${styles.grid} ${className}`}>
      {children}
    </div>
  );
}