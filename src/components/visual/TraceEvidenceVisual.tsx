import { Database, Fingerprint, GitBranch, LockKeyhole } from "lucide-react";
import { useRef } from "react";
import { useScroll3D } from "../../hooks/useScrollAnimation";
import styles from "./TraceEvidenceVisual.module.css";

interface VisualRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "green" | "gold" | "stone" | "red";
}

function VisualRow({ icon, label, value, tone }: VisualRowProps) {
  return (
    <div className={`${styles.row} ${styles[tone]}`}>
      <div className={styles.rowIcon}>{icon}</div>
      <div>
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
    </div>
  );
}

export function TraceEvidenceVisual() {
  const { ref, isInView } = useScroll3D();

  return (
    <div ref={ref} className={`${styles.visual} ${styles.scroll3d} ${isInView ? "is-in-view" : ""}`} aria-label="Trace evidence record preview">
      <div className={styles.header}>
        <span>Trace evidence record</span>
        <strong>Observe mode</strong>
      </div>
      <div className={styles.stack}>
        <VisualRow icon={<Database />} label="Interaction captured" value="Provider, model, tool context" tone="green" />
        <VisualRow icon={<Fingerprint />} label="Controls evaluated" value="PII boundary, data access, domain policy" tone="gold" />
        <VisualRow icon={<GitBranch />} label="Review path opened" value="Owner, rationale, evidence state" tone="stone" />
        <VisualRow icon={<LockKeyhole />} label="Audit material retained" value="Export-ready record" tone="red" />
      </div>
    </div>
  );
}