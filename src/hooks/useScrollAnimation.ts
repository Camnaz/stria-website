import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

export interface StaggeredRevealOptions {
  selector?: string;
  delay?: number;
  stagger?: number;
  trigger?: Element | string;
  rootMargin?: string;
  threshold?: number | number[];
}

export function useStaggeredReveal(
  options: StaggeredRevealOptions = {}
): React.RefObject<HTMLElement> {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const container = containerRef.current;
    if (!container) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const elements = container.querySelectorAll(options.selector ?? "[data-reveal]");
            elements.forEach((el, i) => {
              const item = el as HTMLElement;
              item.style.transitionDelay = `${(options.delay ?? 0) + i * (options.stagger ?? 0.1)}s`;
              item.classList.add("is-in-view");
            });
            if (observerRef.current) {
              observerRef.current.unobserve(container);
            }
          }
        });
      },
      {
        rootMargin: options.rootMargin ?? "0px",
        threshold: options.threshold ?? 0.1,
      }
    );

    observerRef.current.observe(container);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [containerRef.current, options.selector, options.delay, options.stagger, options.rootMargin, options.threshold, prefersReducedMotion]);

  return containerRef;
}

export function useScrollReveal(
  options: {
    rootMargin?: string;
    threshold?: number | number[];
    triggerOnce?: boolean;
  } = {}
): { ref: React.RefObject<HTMLElement>; isInView: boolean } {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsInView(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          if (options.triggerOnce) {
            observer.unobserve(element);
          }
        } else if (!options.triggerOnce) {
          setIsInView(false);
        }
      },
      {
        rootMargin: options.rootMargin ?? "0px",
        threshold: options.threshold ?? 0.1,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [options.rootMargin, options.threshold, options.triggerOnce, prefersReducedMotion]);

  return { ref, isInView };
}

export function useScroll3D(
  options: {
    rootMargin?: string;
    threshold?: number | number[];
  } = {}
): { ref: React.RefObject<HTMLElement>; isInView: boolean } {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsInView(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        } else {
          setIsInView(false);
        }
      },
      {
        rootMargin: options.rootMargin ?? "0px",
        threshold: options.threshold ?? 0.1,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [options.rootMargin, options.threshold, prefersReducedMotion]);

  return { ref, isInView };
}

export function scrollToTop(prefersReducedMotion: boolean): void {
  if (prefersReducedMotion) {
    window.scrollTo({ top: 0, behavior: "instant" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}