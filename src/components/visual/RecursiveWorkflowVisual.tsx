import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./RecursiveWorkflowVisual.module.css";

const nodes = ["LLM", "Trace", "Cluster", "Forge", "Registry", "Deploy"];

export function RecursiveWorkflowVisual() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { rotateX: 8, rotateY: -14, translateZ: -50, opacity: 0.65, y: 36 },
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
            end: "top 45%",
            scrub: 0.6,
          },
        }
      );
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className={`${styles.visual} ${styles.scroll3d}`} aria-hidden="true">
      <div className={styles.glass}>
        <div className={styles.topline}>
          <span>Automated workflow loop</span>
          <strong>live</strong>
        </div>
        <div className={styles.nodeGrid}>
          {nodes.map((node, index) => (
            <span key={node} style={{ "--i": index } as React.CSSProperties}>
              {node}
            </span>
          ))}
        </div>
        <div className={styles.pulseRing} />
      </div>
    </div>
  );
}