import { useEffect, useRef } from "react";
import { useReducedMotion } from "./useReducedMotion";

export interface UseNativeScrollOptions {
  behavior?: "auto" | "smooth";
}

export function useNativeScroll(
  onScroll?: (scrollY: number) => void,
  deps: React.DependencyList = [],
  options: UseNativeScrollOptions = {}
): { scrollToTop: (behavior?: "auto" | "smooth") => void } {
  const prefersReducedMotion = useReducedMotion();
  const rafRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);

  const scrollToTop = (behavior?: "auto" | "smooth") => {
    if (prefersReducedMotion) {
      window.scrollTo({ top: 0, behavior: "instant" });
    } else {
      window.scrollTo({ top: 0, behavior: behavior ?? "smooth" });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      if (scrollY !== lastScrollYRef.current) {
        lastScrollYRef.current = scrollY;
        onScroll?.(scrollY);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [onScroll, ...deps]);

  return { scrollToTop };
}