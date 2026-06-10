import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./OperatorCanvas.module.css";

export function OperatorCanvas() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const children = ref.current.querySelectorAll(`.${styles.alert}, .${styles.chat}, .${styles.actions}`);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { rotateY: -12, rotateX: 6, translateZ: -56, opacity: 0.6, y: 30 },
        {
          rotateY: 0,
          rotateX: 0,
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
        children,
        { translateZ: -24, opacity: 0, y: 18 },
        {
          translateZ: 0,
          opacity: 1,
          y: 0,
          stagger: 0.1,
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
    <div ref={ref} className={`${styles.canvas} ${styles.scroll3d}`} aria-label="Trace operator copilot preview">
      <div className={styles.alert}>
        <span>Malicious LLM intent detected</span>
        <strong>Flagged - managed-ai-usage-review</strong>
        <p>
          Trace allowed the action in observe mode, preserved custody evidence, and routed the event for security review.
        </p>
      </div>
      <div className={styles.chat}>
        <div className={styles.question}>Why was this flagged?</div>
        <div className={styles.answer}>
          The query resembles unsafe credential theft. Trace linked the prompt hash, browser destination, policy rule, identity owner, and record hash.
        </div>
      </div>
      <div className={styles.actions}>
        <span>What evidence supports this?</span>
        <span>Who owns the agent?</span>
        <span>Would enforce mode block it?</span>
      </div>
    </div>
  );
}