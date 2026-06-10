import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "./useReducedMotion";

interface ScrollAnimationOptions {
  trigger?: Element | string;
  start?: string;
  end?: string;
  scrub?: number | boolean;
  onEnter?: () => void;
  onLeave?: () => void;
  onEnterBack?: () => void;
  onLeaveBack?: () => void;
}

export function useScrollAnimation(
  animation: gsap.core.Timeline | (() => gsap.core.Timeline),
  options: ScrollAnimationOptions = {}
): void {
  const prefersReducedMotion = useReducedMotion();
  const ctxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const timeline = typeof animation === "function" ? animation() : animation;

      ScrollTrigger.create({
        trigger: options.trigger,
        start: options.start,
        end: options.end,
        scrub: options.scrub,
        animation: timeline,
        onEnter: options.onEnter,
        onLeave: options.onLeave,
        onEnterBack: options.onEnterBack,
        onLeaveBack: options.onLeaveBack,
      });
    });

    ctxRef.current = ctx;

    return () => {
      ctx.revert();
      ctxRef.current = null;
    };
  }, [animation, options.trigger, options.start, options.end, options.scrub, prefersReducedMotion]);
}

export function useScrollTrigger(
  trigger: Element | string,
  animation: gsap.core.Timeline | (() => gsap.core.Timeline),
  options: ScrollAnimationOptions = {}
): void {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const timeline = typeof animation === "function" ? animation() : animation;

      ScrollTrigger.create({
        trigger,
        start: options.start,
        end: options.end,
        scrub: options.scrub,
        animation: timeline,
        onEnter: options.onEnter,
        onLeave: options.onLeave,
        onEnterBack: options.onEnterBack,
        onLeaveBack: options.onLeaveBack,
      });
    });

    return () => ctx.revert();
  }, [trigger, animation, options.start, options.end, options.scrub, prefersReducedMotion]);
}

export function useStaggeredReveal(
  selector: string,
  options: {
    from?: gsap.TweenVars;
    to?: gsap.TweenVars;
    stagger?: number;
    trigger?: Element | string;
    start?: string;
    end?: string;
    scrub?: number | boolean;
  } = {}
): React.RefObject<HTMLElement> {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const container = containerRef.current;
      if (!container) return;

      const elements = container.querySelectorAll(selector);
      if (elements.length === 0) return;

      gsap.fromTo(
        elements,
        options.from ?? { opacity: 0, y: 20 },
        {
          ...(options.to ?? { opacity: 1, y: 0 }),
          stagger: options.stagger ?? 0.1,
          ease: "none",
          scrollTrigger: {
            trigger: options.trigger ?? container,
            start: options.start ?? "top 90%",
            end: options.end ?? "top 45%",
            scrub: options.scrub ?? 0.6,
          },
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [selector, options.from, options.to, options.stagger, options.trigger, options.start, options.end, options.scrub, prefersReducedMotion]);

  return containerRef;
}