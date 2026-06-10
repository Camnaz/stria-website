import { useEffect } from "react";

export function useCursorField(): void {
  useEffect(() => {
    let frame = 0;
    const updateCursorField = (event: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        document.documentElement.style.setProperty("--cursor-x", `${event.clientX}px`);
        document.documentElement.style.setProperty("--cursor-y", `${event.clientY}px`);
        frame = 0;
      });
    };

    window.addEventListener("pointermove", updateCursorField, { passive: true });
    return () => {
      window.removeEventListener("pointermove", updateCursorField);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
}