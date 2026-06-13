import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

type SignalModelVariant = "home" | "platform" | "trace" | "forge" | "docs" | "architecture" | "demo";

interface SignalModelProps {
  className?: string;
  variant?: SignalModelVariant;
}

const variantColor: Record<SignalModelVariant, number> = {
  home: 0xd4af37,
  platform: 0xd4af37,
  trace: 0x78bfe7,
  forge: 0xdfaa49,
  docs: 0x94c7df,
  architecture: 0xd4af37,
  demo: 0xd4af37,
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function SignalModel({ className = "", variant = "home" }: SignalModelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cleanup = () => {};
    let cancelled = false;
    let idleHandle = 0;

    const scheduleMount = (callback: () => void) => {
      const idleWindow = window as Window & {
        cancelIdleCallback?: (handle: number) => void;
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      };

      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(callback, { timeout: 900 });
        return () => idleWindow.cancelIdleCallback?.(idleHandle);
      }

      idleHandle = window.setTimeout(callback, 180);
      return () => window.clearTimeout(idleHandle);
    };

    async function mount() {
      const THREE = await import("three");
      if (cancelled || !canvas) return;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas,
        powerPreference: "low-power",
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0.15, 7.4);

      const accent = variantColor[variant];
      const group = new THREE.Group();
      scene.add(group);

      const softMaterial = new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: variant === "trace" ? 0.24 : 0.2,
      });
      const dimMaterial = new THREE.LineBasicMaterial({
        color: accent,
        transparent: true,
        opacity: variant === "forge" ? 0.34 : 0.24,
      });
      const nodeMaterial = new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.72,
      });

      const nodeGeometry = new THREE.SphereGeometry(0.045, 12, 8);
      const nodes: Array<{
        scale: { setScalar: (value: number) => void };
      }> = [];

      const addNode = (x: number, y: number, z: number, scale = 1) => {
        const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
        node.position.set(x, y, z);
        node.scale.setScalar(scale);
        group.add(node);
        nodes.push(node);
      };

      const addLine = (points: Array<[number, number, number]>, opacity = dimMaterial.opacity) => {
        const geometry = new THREE.BufferGeometry().setFromPoints(
          points.map((point) => new THREE.Vector3(point[0], point[1], point[2])),
        );
        const material = dimMaterial.clone();
        material.opacity = opacity;
        const line = new THREE.Line(geometry, material);
        group.add(line);
      };

      const addPlaneFrame = (width: number, height: number, z: number) => {
        const shape = [
          [-width / 2, -height / 2, z],
          [width / 2, -height / 2, z],
          [width / 2, height / 2, z],
          [-width / 2, height / 2, z],
          [-width / 2, -height / 2, z],
        ] as Array<[number, number, number]>;
        addLine(shape, 0.2);
      };

      const addBoundaryDots = (
        width: number,
        height: number,
        z: number,
        count: number,
        offsetX = 0,
        offsetY = 0,
      ) => {
        for (let i = 0; i < count; i += 1) {
          const phase = i / count;
          const side = Math.floor(phase * 4);
          const local = (phase * 4) % 1;
          let x = 0;
          let y = 0;
          if (side === 0) {
            x = -width / 2 + local * width;
            y = -height / 2;
          } else if (side === 1) {
            x = width / 2;
            y = -height / 2 + local * height;
          } else if (side === 2) {
            x = width / 2 - local * width;
            y = height / 2;
          } else {
            x = -width / 2;
            y = height / 2 - local * height;
          }
          addNode(x + offsetX, y + offsetY, z, i % 5 === 0 ? 1.28 : 0.86);
        }
      };

      const addOrbitDots = (radiusX: number, radiusY: number, count: number, z = 0, offsetX = 0, offsetY = 0) => {
        for (let i = 0; i < count; i += 1) {
          const angle = (i / count) * Math.PI * 2;
          addNode(
            offsetX + Math.cos(angle) * radiusX,
            offsetY + Math.sin(angle) * radiusY,
            z + Math.sin(angle * 2) * 0.12,
            i % 4 === 0 ? 1.2 : 0.82,
          );
        }
      };

      if (variant === "trace") {
        addPlaneFrame(2.72, 1.72, -0.18);
        addBoundaryDots(2.72, 1.72, -0.08, 28);
        [-0.55, 0, 0.55].forEach((y) => addLine([[-1.18, y, -0.18], [1.18, y, -0.18]], 0.15));
        [
          [-2.16, 0.86, 0.12],
          [-2.0, 0.18, 0.2],
          [-2.12, -0.64, -0.05],
          [-0.86, 0.42, 0.1],
          [-0.26, -0.2, 0.16],
          [0.68, 0.28, 0.04],
          [1.26, -0.44, 0.12],
        ].forEach(([x, y, z], index) => addNode(x, y, z, index > 4 ? 1.25 : 1));
        addLine([[-2.16, 0.86, 0.12], [-0.86, 0.42, 0.1], [0.68, 0.28, 0.04], [1.1, 0.55, -0.18]], 0.34);
        addLine([[-2.0, 0.18, 0.2], [-0.26, -0.2, 0.16], [1.06, 0, -0.18]], 0.28);
        addLine([[-2.12, -0.64, -0.05], [-0.26, -0.2, 0.16], [1.26, -0.44, 0.12]], 0.22);
      } else if (variant === "forge") {
        const boxGeometry = new THREE.BoxGeometry(0.58, 0.38, 0.38);
        addBoundaryDots(1.35, 1.1, 0.04, 18, -1.18, 0.08);
        addBoundaryDots(1.7, 1.25, 0.02, 22, 0.82, -0.04);
        [-0.75, 0.08, 0.92].forEach((x, index) => {
          const box = new THREE.Mesh(boxGeometry, softMaterial.clone());
          box.position.set(x, 0.1 - index * 0.18, 0);
          box.rotation.set(0.22, 0.5, 0.04);
          group.add(box);
          addNode(x, 0.72 - index * 0.2, 0.15, 1.25);
        });
        addLine([[-1.65, 0.9, 0.2], [-0.85, 0.72, 0.15], [0, 0.52, 0.15], [0.85, 0.32, 0.15], [1.65, 0.08, 0.2]], 0.36);
        addLine([[-1.3, -0.72, 0.05], [-0.2, -0.48, 0.12], [1.2, -0.78, 0.05]], 0.18);
      } else if (variant === "platform") {
        addBoundaryDots(1.58, 1.12, 0.02, 20, -0.9, 0.04);
        addBoundaryDots(1.58, 1.12, 0.02, 20, 0.9, -0.04);
        addLine([[-1.68, 0.2, 0.12], [-0.52, 0.2, 0.1], [0.52, -0.18, 0.1], [1.68, -0.18, 0.12]], 0.34);
        addLine([[-1.68, -0.32, 0.05], [-0.52, -0.12, 0.1], [0.52, 0.32, 0.1], [1.68, 0.28, 0.08]], 0.22);
        addOrbitDots(1.9, 0.72, 16, -0.1, 0, 0);
      } else if (variant === "architecture") {
        [-1.28, 0, 1.28].forEach((x, index) => {
          addBoundaryDots(0.86, 1.24, 0.02, 14, x, index === 1 ? 0.12 : -0.04);
        });
        addLine([[-1.72, 0.68, 0.08], [-0.42, 0.86, 0.08], [0.42, 0.86, 0.08], [1.72, 0.66, 0.08]], 0.24);
        addLine([[-1.72, -0.66, 0.08], [-0.42, -0.82, 0.08], [0.42, -0.82, 0.08], [1.72, -0.66, 0.08]], 0.24);
      } else {
        const torusGeometry = new THREE.TorusGeometry(1.16, 0.005, 8, 96);
        [0, 0.72, -0.72].forEach((rotation, index) => {
          const torus = new THREE.Mesh(torusGeometry, softMaterial.clone());
          torus.rotation.set(1.14, rotation, index * 0.58);
          torus.scale.set(1 + index * 0.15, 0.62 + index * 0.08, 1);
          group.add(torus);
        });
        addOrbitDots(1.55, 0.86, 18, 0);
        addBoundaryDots(2.4, 1.38, -0.16, 24);
      }

      const reduced = prefersReducedMotion();
      let width = 0;
      let height = 0;
      let raf = 0;
      let visible = true;
      let last = 0;

      const resize = () => {
        width = Math.max(1, canvas.clientWidth);
        height = Math.max(1, canvas.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };

      const render = (time: number) => {
        raf = 0;
        if (!visible) return;
        if (!reduced && time - last < 32) {
          raf = window.requestAnimationFrame(render);
          return;
        }
        last = time;
        const t = reduced ? 0.8 : time * 0.00035;
        group.rotation.y = Math.sin(t) * 0.18;
        group.rotation.x = Math.cos(t * 0.76) * 0.08;
        nodes.forEach((node, index) => {
          const pulse = 1 + Math.sin(t * 5 + index) * 0.12;
          node.scale.setScalar(pulse);
        });
        renderer.render(scene, camera);
        if (!reduced) raf = window.requestAnimationFrame(render);
      };

      const requestRender = () => {
        if (raf || !visible) return;
        raf = window.requestAnimationFrame(render);
      };

      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) requestRender();
      });

      resize();
      observer.observe(canvas);
      window.addEventListener("resize", resize, { passive: true });
      requestRender();

      cleanup = () => {
        observer.disconnect();
        window.removeEventListener("resize", resize);
        if (raf) window.cancelAnimationFrame(raf);
        group.traverse((object) => {
          const mesh = object as {
            geometry?: { dispose: () => void };
            material?: { dispose?: () => void } | Array<{ dispose?: () => void }>;
          };
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose?.());
          else mesh.material?.dispose?.();
        });
        renderer.dispose();
      };
    }

    const cancelMount = scheduleMount(() => {
      mount().catch(() => {});
    });

    return () => {
      cancelled = true;
      cancelMount();
      cleanup();
    };
  }, [variant]);

  const canvasStyle: CSSProperties = className
    ? {
        pointerEvents: "none",
        position: "absolute",
        zIndex: 0,
      }
    : {
        height: "100%",
        inset: 0,
        pointerEvents: "none",
        position: "absolute",
        width: "100%",
        zIndex: 0,
      };

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={canvasStyle}
    />
  );
}
