import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./FlowDiagram.module.css";

interface FlowDiagramProps {
  steps: string[];
}

export function FlowDiagram({ steps }: FlowDiagramProps) {
  const ref = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const items = ref.current.querySelectorAll("li");
    const ctx = gsap.context(() => {
      gsap.fromTo(
        items,
        { rotateX: 14, translateZ: -36, opacity: 0, y: 26 },
        {
          rotateX: 0,
          translateZ: 0,
          opacity: 1,
          y: 0,
          stagger: 0.1,
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
  }, [steps]);

  return (
    <ol ref={ref} className={`${styles.diagram} ${styles.scroll3d}`} aria-label="Trace execution flow">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}