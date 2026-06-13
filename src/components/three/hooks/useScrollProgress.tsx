import React, { createContext, useContext, useEffect, useState } from 'react';

interface ScrollProgressContextValue {
  scrollY: number;
  scrollProgress: number; // 0-1
  viewportHeight: number;
  documentHeight: number;
  direction: 'up' | 'down';
  velocity: number;
}

const ScrollProgressContext = createContext<ScrollProgressContextValue | null>(null);

export function ScrollProgressProvider({ children }: { children: React.ReactNode }) {
  const [scrollY, setScrollY] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [documentHeight, setDocumentHeight] = useState(document.documentElement.scrollHeight);
  const [direction, setDirection] = useState<'up' | 'down'>('down');
  const [velocity, setVelocity] = useState(0);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let lastTime = performance.now();
    let ticking = false;

    const update = () => {
      const currentScrollY = window.scrollY;
      const currentTime = performance.now();
      const dt = currentTime - lastTime;

      const newDirection = currentScrollY > lastScrollY ? 'down' : 'up';
      const newVelocity = dt > 0 ? Math.abs(currentScrollY - lastScrollY) / dt : 0;

      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(1, Math.max(0, currentScrollY / docHeight)) : 0;

      setScrollY(currentScrollY);
      setScrollProgress(progress);
      setDirection(newDirection);
      setVelocity(newVelocity);
      setDocumentHeight(docHeight);
      setViewportHeight(window.innerHeight);

      lastScrollY = currentScrollY;
      lastTime = currentTime;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    const onResize = () => {
      setViewportHeight(window.innerHeight);
      setDocumentHeight(document.documentElement.scrollHeight - window.innerHeight);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    // Initial values
    update();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <ScrollProgressContext.Provider value={{ scrollY, scrollProgress, viewportHeight, documentHeight, direction, velocity }}>
      {children}
    </ScrollProgressContext.Provider>
  );
}

export function useScrollProgress() {
  const context = useContext(ScrollProgressContext);
  if (!context) {
    throw new Error('useScrollProgress must be used within a ScrollProgressProvider');
  }
  return context;
}

// Hook for smooth scroll-triggered values
export function useScrollValue(
  startProgress: number,
  endProgress: number,
  options: { clamp?: boolean; ease?: (t: number) => number } = {}
) {
  const { scrollProgress } = useScrollProgress();
  const { clamp = true, ease = (t) => t } = options;

  const progress = (scrollProgress - startProgress) / (endProgress - startProgress);
  const clamped = clamp ? Math.max(0, Math.min(1, progress)) : progress;
  return ease(clamped);
}

// Easing functions
export const easings = {
  linear: (t: number) => t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeOutExpo: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeOutQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};