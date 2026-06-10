import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./ForgeObject.module.css";

export function ForgeObject() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const plates = ref.current.querySelectorAll(`.${styles.plate}`);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { rotateX: 18, rotateY: -16, translateZ: -70, opacity: 0.6, y: 30 },
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
      gsap.fromTo(
        plates,
        { translateZ: (i) => [-64, 0, 64][i] },
        {
          translateZ: (i) => [-36, 0, 36][i],
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
    <div ref={ref} className={`${styles.object} ${styles.scroll3d}`} aria-hidden="true">
      <div className={`${styles.plate} ${styles.plateA}`} />
      <div className={`${styles.plate} ${styles.plateB}`} />
      <div className={`${styles.plate} ${styles.plateC}`} />
      <div className={styles.score}>
        <span>primitive</span>
        <strong>94</strong>
      </div>
    </div>
  );
}