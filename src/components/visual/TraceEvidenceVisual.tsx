import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Database, Fingerprint, GitBranch, LockKeyhole } from "lucide-react";
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const rows = ref.current.querySelectorAll(`.${styles.row}`);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { rotateX: 10, rotateY: -8, translateZ: -44, opacity: 0.6, y: 30 },
        {
          rotateX: 0,
          rotateY: 0,
          translateZ: 0,
          opacity: 1,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: ref.current,
            start: "top 90%",
            end: "top 48%",
            scrub: 0.6,
          },
        }
      );
      gsap.fromTo(
        rows,
        { translateZ: -28, opacity: 0, y: 16 },
        {
          translateZ: 0,
          opacity: 1,
          y: 0,
          stagger: 0.08,
          ease: "none",
          scrollTrigger: {
            trigger: ref.current,
            start: "top 86%",
            end: "top 45%",
            scrub: 0.6,
          },
        }
      );
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className={`${styles.visual} ${styles.scroll3d}`} aria-label="Trace evidence record preview">
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