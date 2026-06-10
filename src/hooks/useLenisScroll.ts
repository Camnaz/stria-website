import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface UseLenisScrollOptions {
  lerp?: number;
  duration?: number;
  smoothWheel?: boolean;
  wheelMultiplier?: number;
  touchMultiplier?: number;
  syncTouch?: boolean;
  infinite?: boolean;
}

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefers(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefers(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return prefers;
}

export function useLenisScroll(
  onScroll?: (lenis: Lenis) => void,
  deps: React.DependencyList = [],
  options: UseLenisScrollOptions = {}
): Lenis | null {
  const lenisRef = useRef<Lenis | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const lenis = new Lenis({
      lerp: prefersReducedMotion ? 1 : options.lerp ?? 0.085,
      duration: prefersReducedMotion ? 0 : options.duration ?? 1.4,
      smoothWheel: prefersReducedMotion ? false : options.smoothWheel ?? true,
      wheelMultiplier: options.wheelMultiplier ?? 0.85,
      touchMultiplier: options.touchMultiplier ?? 1.2,
      syncTouch: prefersReducedMotion ? false : options.syncTouch ?? true,
      infinite: options.infinite ?? false,
    });

    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!lenisRef.current || prefersReducedMotion) return;

    const handleScroll = () => {
      onScroll?.(lenisRef.current!);
    };

    lenisRef.current.on("scroll", handleScroll);
    return () => {
      lenisRef.current?.off("scroll", handleScroll);
    };
  }, [onScroll, prefersReducedMotion, ...deps]);

  return lenisRef.current;
}