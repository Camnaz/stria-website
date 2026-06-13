import { useEffect, useRef } from 'react';

interface ScrollCanvasProps {
  className?: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ScrollCanvas({ className = '' }: ScrollCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    let frame = 0;
    let scrollY = window.scrollY;
    let visible = true;
    const reducedMotion = prefersReducedMotion();

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const drawPoly = (cx: number, cy: number, radius: number, sides: number, spin: number, alpha: number) => {
      context.beginPath();
      for (let i = 0; i <= sides; i += 1) {
        const angle = spin + (i / sides) * Math.PI * 2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius * 0.72;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = `rgba(103, 195, 210, ${alpha})`;
      context.lineWidth = 1;
      context.stroke();
    };

    const draw = () => {
      frame = 0;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const cx = width * 0.52;
      const cy = height * 0.5;
      const radius = Math.max(64, Math.min(width, height) * 0.24);
      const spin = reducedMotion ? 0.4 : scrollY * 0.0009;

      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = 'screen';

      const gradient = context.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * 1.55);
      gradient.addColorStop(0, 'rgba(103, 195, 210, 0.11)');
      gradient.addColorStop(0.55, 'rgba(103, 195, 210, 0.035)');
      gradient.addColorStop(1, 'rgba(103, 195, 210, 0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      drawPoly(cx, cy, radius, 12, spin, 0.18);
      drawPoly(cx, cy, radius * 0.68, 8, -spin * 1.3, 0.1);

      context.strokeStyle = 'rgba(143, 183, 194, 0.08)';
      context.lineWidth = 1;
      context.beginPath();
      context.ellipse(cx, cy, radius * 1.18, radius * 0.38, spin * 0.18, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.ellipse(cx, cy, radius * 1.34, radius * 0.46, -0.74 + spin * 0.12, 0, Math.PI * 2);
      context.stroke();

      context.restore();
    };

    const requestDraw = () => {
      if (!visible || frame) return;
      frame = window.requestAnimationFrame(draw);
    };

    const onScroll = () => {
      scrollY = window.scrollY;
      requestDraw();
    };

    const onResize = () => {
      resize();
      requestDraw();
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) requestDraw();
    });

    resize();
    draw();
    observer.observe(canvas);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
