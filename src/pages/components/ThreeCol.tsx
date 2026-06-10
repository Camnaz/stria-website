import styles from "./ThreeCol.module.css";
import type { ReactNode } from "react";

interface ThreeColProps {
  children: ReactNode;
  className?: string;
}

export function ThreeCol({ children, className = "" }: ThreeColProps) {
  return (
    <div className={`${styles.grid} ${className}`}>
      {children}
    </div>
  );
}