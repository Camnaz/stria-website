import styles from "./StatusPill.module.css";

export interface StatusPillProps {
  children: React.ReactNode;
  variant?: "success" | "failed" | "flagged" | "candidate" | "testing" | "approved" | "deployed" | "pending" | "active" | "paused" | "rolled_back";
  className?: string;
}

export function StatusPill({ children, variant = "success", className = "" }: StatusPillProps) {
  return (
    <span className={`${styles.statusPill} ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}