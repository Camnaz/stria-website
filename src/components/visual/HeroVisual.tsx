import { useEffect, useRef } from "react";

export type HeroVisualVariant = "home" | "trace" | "forge" | "platform" | "architecture" | "docs";

interface HeroVisualProps {
  variant: HeroVisualVariant;
  className?: string;
}

/* ─── Color palette ─── */
const BRASS = { r: 212, g: 175, b: 55 };
const CYAN = { r: 120, g: 191, b: 231 };
const WARM = { r: 223, g: 170, b: 73 };

function rgba(c: { r: number; g: number; b: number }, a: number) {
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpColor(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) {
  return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) };
}

/* ─── Particle type ─── */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  phase: number;
}

/* ─── Node type ─── */
interface Node {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  pulse: number;
  speed: number;
}

/* ═══════════════════════════════════════════════════════════════
   HOME: Evidence trail network — particles flow along paths
   between nodes, representing data being captured
   ═══════════════════════════════════════════════════════════════ */
function drawHome(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, scroll: number) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  // Scale relative to the smaller dimension, filling ~70% of available space
  const baseRadius = Math.min(w, h) * 0.32;
  const s = baseRadius / 100; // unit scale
  const offset = scroll * 0.12;

  // Outer ring — evidence network boundary
  const outerR = baseRadius * 1.1;
  ctx.beginPath();
  ctx.ellipse(cx, cy - offset, outerR, outerR * 0.85, 0, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(BRASS, 0.06);
  ctx.lineWidth = 0.5 * s;
  ctx.stroke();

  // Outer node ring — 10 nodes orbiting slowly
  const outerCount = 10;
  const outerNodes: Array<{ x: number; y: number; r: number }> = [];
  for (let i = 0; i < outerCount; i++) {
    const angle = (i / outerCount) * Math.PI * 2 + t * 0.12;
    const wobble = Math.sin(t * 0.8 + i * 1.5) * 8 * s;
    outerNodes.push({
      x: cx + Math.cos(angle) * (outerR + wobble),
      y: cy + Math.sin(angle) * (outerR * 0.85 + wobble) - offset,
      r: (2.5 + Math.sin(t + i) * 0.8) * s,
    });
  }

  // Middle ring — 6 nodes, faster orbit
  const midR = baseRadius * 0.6;
  const midCount = 6;
  const midNodes: Array<{ x: number; y: number; r: number }> = [];
  for (let i = 0; i < midCount; i++) {
    const angle = (i / midCount) * Math.PI * 2 - t * 0.25;
    midNodes.push({
      x: cx + Math.cos(angle) * midR,
      y: cy + Math.sin(angle) * midR * 0.8 - offset,
      r: (3 + Math.sin(t * 1.4 + i) * 1) * s,
    });
  }

  // Inner ring — 4 nodes, closest to core
  const innerR = baseRadius * 0.28;
  const innerCount = 4;
  const innerNodes: Array<{ x: number; y: number; r: number }> = [];
  for (let i = 0; i < innerCount; i++) {
    const angle = (i / innerCount) * Math.PI * 2 + t * 0.4;
    innerNodes.push({
      x: cx + Math.cos(angle) * innerR,
      y: cy + Math.sin(angle) * innerR * 0.75 - offset,
      r: 2.2 * s,
    });
  }

  // Draw connections — outer to mid
  ctx.lineWidth = 0.4 * s;
  for (let i = 0; i < outerCount; i++) {
    const mid = midNodes[i % midCount];
    ctx.beginPath();
    ctx.moveTo(outerNodes[i].x, outerNodes[i].y);
    ctx.lineTo(mid.x, mid.y);
    ctx.strokeStyle = rgba(BRASS, 0.06 + Math.sin(t + i * 0.7) * 0.02);
    ctx.stroke();
  }

  // Connections — mid to inner
  for (let i = 0; i < midCount; i++) {
    const inner = innerNodes[i % innerCount];
    ctx.beginPath();
    ctx.moveTo(midNodes[i].x, midNodes[i].y);
    ctx.lineTo(inner.x, inner.y);
    ctx.strokeStyle = rgba(BRASS, 0.1);
    ctx.stroke();
  }

  // Connections — outer ring segments
  for (let i = 0; i < outerCount; i++) {
    const next = outerNodes[(i + 1) % outerCount];
    ctx.beginPath();
    ctx.moveTo(outerNodes[i].x, outerNodes[i].y);
    ctx.lineTo(next.x, next.y);
    ctx.strokeStyle = rgba(BRASS, 0.05);
    ctx.stroke();
  }

  // Flowing particles — outer → mid → inner → core
  for (let i = 0; i < 20; i++) {
    const progress = ((t * 0.3 + i * 0.12) % 1);
    const outerIdx = i % outerCount;
    const midIdx = i % midCount;
    const from = outerNodes[outerIdx];
    const mid = midNodes[midIdx];
    const to = { x: cx, y: cy - offset };

    let px: number, py: number;
    if (progress < 0.5) {
      const p2 = progress * 2;
      px = lerp(from.x, mid.x, p2);
      py = lerp(from.y, mid.y, p2);
    } else {
      const p2 = (progress - 0.5) * 2;
      px = lerp(mid.x, to.x, p2);
      py = lerp(mid.y, to.y, p2);
    }
    const alpha = Math.sin(progress * Math.PI) * 0.55;
    ctx.beginPath();
    ctx.arc(px, py, (1 + progress * 1.2) * s, 0, Math.PI * 2);
    ctx.fillStyle = rgba(BRASS, alpha);
    ctx.fill();
  }

  // Draw outer nodes
  for (const node of outerNodes) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(BRASS, 0.4);
    ctx.fill();
  }

  // Draw mid nodes with glow
  for (const node of midNodes) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r * 2.5, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.r * 2.5);
    glow.addColorStop(0, rgba(BRASS, 0.1));
    glow.addColorStop(1, rgba(BRASS, 0));
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(BRASS, 0.6);
    ctx.fill();
  }

  // Draw inner nodes
  for (const node of innerNodes) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(BRASS, 0.75);
    ctx.fill();
  }

  // Central core — pulsing
  const coreR = (5 + Math.sin(t * 1.5) * 1.5) * s;
  ctx.beginPath();
  ctx.arc(cx, cy - offset, coreR * 3.5, 0, Math.PI * 2);
  const coreGlow = ctx.createRadialGradient(cx, cy - offset, 0, cx, cy - offset, coreR * 3.5);
  coreGlow.addColorStop(0, rgba(BRASS, 0.2));
  coreGlow.addColorStop(0.5, rgba(BRASS, 0.05));
  coreGlow.addColorStop(1, rgba(BRASS, 0));
  ctx.fillStyle = coreGlow;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy - offset, coreR, 0, Math.PI * 2);
  ctx.fillStyle = rgba(BRASS, 0.85);
  ctx.fill();
}

/* ═══════════════════════════════════════════════════════════════
   TRACE: Evidence chain — blocks linked by hash connections,
   with particles flowing through a policy gate ring
   ═══════════════════════════════════════════════════════════════ */
function drawTrace(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, scroll: number) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const scale = Math.min(w, h) / 400;
  const offset = scroll * 0.12;

  // Evidence blocks — chain of linked rectangles
  const blockCount = 7;
  const chainWidth = 200 * scale;
  const blockW = 18 * scale;
  const blockH = 12 * scale;
  const spacing = chainWidth / (blockCount - 1);

  // Policy gate — ring in the center
  const gateRadius = 60 * scale;
  ctx.beginPath();
  ctx.arc(cx, cy - offset, gateRadius, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(CYAN, 0.18);
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();

  // Rotating gate segments
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + t * 0.6;
    const arcLen = 0.3;
    ctx.beginPath();
    ctx.arc(cx, cy - offset, gateRadius, angle, angle + arcLen);
    ctx.strokeStyle = rgba(CYAN, 0.5);
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
  }

  // Evidence chain — positioned in an arc
  const blocks: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < blockCount; i++) {
    const angle = -Math.PI * 0.6 + (i / (blockCount - 1)) * Math.PI * 1.2;
    const radius = 110 * scale;
    const bx = cx + Math.cos(angle + t * 0.08) * radius;
    const by = cy + Math.sin(angle + t * 0.08) * radius * 0.6 - offset;
    blocks.push({ x: bx, y: by });

    // Draw block
    const colorT = i / (blockCount - 1);
    const blockColor = lerpColor(CYAN, { r: 180, g: 220, b: 255 }, colorT);
    ctx.fillStyle = rgba(blockColor, 0.4 + Math.sin(t + i * 0.8) * 0.1);
    ctx.fillRect(bx - blockW / 2, by - blockH / 2, blockW, blockH);
    ctx.strokeStyle = rgba(blockColor, 0.6);
    ctx.lineWidth = 0.5 * scale;
    ctx.strokeRect(bx - blockW / 2, by - blockH / 2, blockW, blockH);
  }

  // Chain links between blocks
  ctx.lineWidth = 0.8 * scale;
  for (let i = 0; i < blocks.length - 1; i++) {
    ctx.beginPath();
    ctx.moveTo(blocks[i].x, blocks[i].y);
    ctx.lineTo(blocks[i + 1].x, blocks[i + 1].y);
    ctx.strokeStyle = rgba(CYAN, 0.2);
    ctx.setLineDash([3 * scale, 3 * scale]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Particles flowing through the gate
  for (let i = 0; i < 16; i++) {
    const progress = ((t * 0.3 + i * 0.12) % 1);
    // Flow from outer ring toward center, then out
    const angle = (i / 16) * Math.PI * 2 + t * 0.15;
    const dist = gateRadius * (1.6 - progress * 1.2);
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist * 0.6 - offset;
    const alpha = Math.sin(progress * Math.PI) * 0.7;
    const size = (1.2 + progress * 1.5) * scale;

    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fillStyle = rgba(CYAN, alpha);
    ctx.fill();
  }

  // Identity nodes — orbiting outer
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + t * 0.4;
    const nx = cx + Math.cos(angle) * 140 * scale;
    const ny = cy + Math.sin(angle) * 80 * scale - offset;
    ctx.beginPath();
    ctx.arc(nx, ny, 4 * scale, 0, Math.PI * 2);
    ctx.fillStyle = rgba(CYAN, 0.7);
    ctx.fill();

    // Connection to nearest block
    const nearest = blocks.reduce((best, b) => {
      const d = Math.hypot(b.x - nx, b.y - ny);
      return d < best.d ? { d, b } : best;
    }, { d: Infinity, b: blocks[0] });
    ctx.beginPath();
    ctx.moveTo(nx, ny);
    ctx.lineTo(nearest.b.x, nearest.b.y);
    ctx.strokeStyle = rgba(CYAN, 0.1);
    ctx.lineWidth = 0.5 * scale;
    ctx.stroke();
  }
}

/* ═══════════════════════════════════════════════════════════════
   FORGE: Workflow clusters converging into a registry
   Scattered clusters on the left → funnel → ordered blocks right
   ═══════════════════════════════════════════════════════════════ */
function drawForge(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, scroll: number) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const scale = Math.min(w, h) / 400;
  const offset = scroll * 0.12;

  // Funnel shape — converging lines
  const funnelLeft = cx - 30 * scale;
  const funnelRight = cx + 30 * scale;
  const funnelTop = cy - 70 * scale - offset;
  const funnelBottom = cy + 70 * scale - offset;

  ctx.beginPath();
  ctx.moveTo(cx - 120 * scale, funnelTop);
  ctx.lineTo(funnelLeft, cy - offset);
  ctx.lineTo(cx - 120 * scale, funnelBottom);
  ctx.strokeStyle = rgba(WARM, 0.12);
  ctx.lineWidth = 0.8 * scale;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(funnelRight, cy - offset);
  ctx.lineTo(cx + 120 * scale, funnelTop);
  ctx.moveTo(funnelRight, cy - offset);
  ctx.lineTo(cx + 120 * scale, funnelBottom);
  ctx.strokeStyle = rgba(WARM, 0.12);
  ctx.stroke();

  // Workflow clusters (left side) — scattered, organic
  const clusters: Array<{ x: number; y: number; nodes: Array<{ x: number; y: number }> }> = [];
  for (let c = 0; c < 4; c++) {
    const clusterX = cx - 100 * scale + Math.sin(c * 2.5) * 30 * scale;
    const clusterY = cy + (c - 1.5) * 40 * scale - offset;
    const clusterNodes: Array<{ x: number; y: number }> = [];

    for (let n = 0; n < 4; n++) {
      const angle = (n / 4) * Math.PI * 2 + t * 0.3 + c;
      const r = 14 * scale + Math.sin(t + n + c) * 4 * scale;
      clusterNodes.push({
        x: clusterX + Math.cos(angle) * r,
        y: clusterY + Math.sin(angle) * r,
      });
    }
    clusters.push({ x: clusterX, y: clusterY, nodes: clusterNodes });

    // Draw cluster connections
    ctx.lineWidth = 0.4 * scale;
    for (let n = 0; n < clusterNodes.length; n++) {
      for (let m = n + 1; m < clusterNodes.length; m++) {
        ctx.beginPath();
        ctx.moveTo(clusterNodes[n].x, clusterNodes[n].y);
        ctx.lineTo(clusterNodes[m].x, clusterNodes[m].y);
        ctx.strokeStyle = rgba(WARM, 0.15);
        ctx.stroke();
      }
    }

    // Draw cluster nodes
    for (const node of clusterNodes) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 2 * scale, 0, Math.PI * 2);
      ctx.fillStyle = rgba(WARM, 0.5);
      ctx.fill();
    }
  }

  // Registry blocks (right side) — ordered, neat
  const registryX = cx + 85 * scale;
  for (let i = 0; i < 4; i++) {
    const ry = cy + (i - 1.5) * 28 * scale - offset;
    const bw = 40 * scale;
    const bh = 16 * scale;
    const pulse = Math.sin(t * 1.5 + i * 0.8) * 0.08;

    ctx.fillStyle = rgba(WARM, 0.2 + pulse);
    ctx.fillRect(registryX - bw / 2, ry - bh / 2, bw, bh);
    ctx.strokeStyle = rgba(WARM, 0.45 + pulse);
    ctx.lineWidth = 0.7 * scale;
    ctx.strokeRect(registryX - bw / 2, ry - bh / 2, bw, bh);

    // Status dot
    ctx.beginPath();
    ctx.arc(registryX + bw / 2 - 4 * scale, ry, 2 * scale, 0, Math.PI * 2);
    ctx.fillStyle = rgba({ r: 100, g: 220, b: 140 }, 0.7);
    ctx.fill();
  }

  // Particles flowing from clusters through funnel to registry
  for (let i = 0; i < 18; i++) {
    const progress = ((t * 0.25 + i * 0.1) % 1);
    const cluster = clusters[i % clusters.length];
    const targetY = cy + ((i % 4) - 1.5) * 28 * scale - offset;

    const px = lerp(cluster.x, registryX, progress);
    const py = lerp(cluster.y, targetY, progress);
    // Narrow at funnel point
    const funnelT = Math.sin(progress * Math.PI);
    const jitter = (1 - funnelT) * 8 * scale * Math.sin(i * 3.7);
    const alpha = Math.sin(progress * Math.PI) * 0.55;

    ctx.beginPath();
    ctx.arc(px, py + jitter * 0.3, (1 + progress) * scale, 0, Math.PI * 2);
    ctx.fillStyle = rgba(WARM, alpha);
    ctx.fill();
  }

  // Verification ring at funnel center
  ctx.beginPath();
  ctx.arc(cx, cy - offset, 18 * scale, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(WARM, 0.3);
  ctx.lineWidth = 1.2 * scale;
  ctx.stroke();

  // Spinning arcs on verification ring
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + t * 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy - offset, 18 * scale, angle, angle + 0.5);
    ctx.strokeStyle = rgba(WARM, 0.65);
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
  }
}

/* ═══════════════════════════════════════════════════════════════
   PLATFORM: Trace→Forge feedback loop — two orbital systems
   connected by flowing bridge particles
   ═══════════════════════════════════════════════════════════════ */
function drawPlatform(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, scroll: number) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const scale = Math.min(w, h) / 400;
  const offset = scroll * 0.12;

  const traceCenter = { x: cx - 60 * scale, y: cy - offset };
  const forgeCenter = { x: cx + 60 * scale, y: cy - offset };
  const orbitRadius = 50 * scale;

  // Draw orbital paths
  ctx.setLineDash([2 * scale, 4 * scale]);
  ctx.lineWidth = 0.6 * scale;

  ctx.beginPath();
  ctx.ellipse(traceCenter.x, traceCenter.y, orbitRadius, orbitRadius * 0.7, 0, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(CYAN, 0.15);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(forgeCenter.x, forgeCenter.y, orbitRadius, orbitRadius * 0.7, 0, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(WARM, 0.15);
  ctx.stroke();
  ctx.setLineDash([]);

  // Trace orbit nodes
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + t * 0.4;
    const nx = traceCenter.x + Math.cos(angle) * orbitRadius;
    const ny = traceCenter.y + Math.sin(angle) * orbitRadius * 0.7;
    ctx.beginPath();
    ctx.arc(nx, ny, 3 * scale, 0, Math.PI * 2);
    ctx.fillStyle = rgba(CYAN, 0.6 + Math.sin(t + i) * 0.15);
    ctx.fill();
  }

  // Forge orbit nodes
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 - t * 0.35;
    const nx = forgeCenter.x + Math.cos(angle) * orbitRadius;
    const ny = forgeCenter.y + Math.sin(angle) * orbitRadius * 0.7;

    // Draw as small rectangles for Forge
    const bw = 6 * scale;
    const bh = 4 * scale;
    ctx.fillStyle = rgba(WARM, 0.55 + Math.sin(t + i) * 0.15);
    ctx.fillRect(nx - bw / 2, ny - bh / 2, bw, bh);
  }

  // Bridge particles — flowing between the two systems
  for (let i = 0; i < 12; i++) {
    const progress = ((t * 0.3 + i * 0.15) % 1);
    const direction = i % 2 === 0; // alternate direction
    const from = direction ? traceCenter : forgeCenter;
    const to = direction ? forgeCenter : traceCenter;

    const px = lerp(from.x, to.x, progress);
    // Arc up between them
    const arcHeight = -30 * scale * Math.sin(progress * Math.PI) * (i % 2 === 0 ? 1 : -1);
    const py = lerp(from.y, to.y, progress) + arcHeight;
    const alpha = Math.sin(progress * Math.PI) * 0.5;
    const color = direction ? CYAN : WARM;

    ctx.beginPath();
    ctx.arc(px, py, 1.5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = rgba(color, alpha);
    ctx.fill();
  }

  // Center labels
  ctx.beginPath();
  ctx.arc(traceCenter.x, traceCenter.y, 8 * scale, 0, Math.PI * 2);
  ctx.fillStyle = rgba(CYAN, 0.25);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(traceCenter.x, traceCenter.y, 4 * scale, 0, Math.PI * 2);
  ctx.fillStyle = rgba(CYAN, 0.7);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(forgeCenter.x, forgeCenter.y, 8 * scale, 0, Math.PI * 2);
  ctx.fillStyle = rgba(WARM, 0.25);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(forgeCenter.x, forgeCenter.y, 4 * scale, 0, Math.PI * 2);
  ctx.fillStyle = rgba(WARM, 0.7);
  ctx.fill();

  // Outer containing ring — platform boundary
  const platformRadius = 110 * scale;
  ctx.beginPath();
  ctx.ellipse(cx, cy - offset, platformRadius, platformRadius * 0.55, 0, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(BRASS, 0.1);
  ctx.lineWidth = 0.8 * scale;
  ctx.stroke();

  // Rotating arcs on outer ring
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + t * 0.15;
    ctx.beginPath();
    ctx.ellipse(cx, cy - offset, platformRadius, platformRadius * 0.55, 0, angle, angle + 0.4);
    ctx.strokeStyle = rgba(BRASS, 0.3);
    ctx.lineWidth = 1.2 * scale;
    ctx.stroke();
  }
}

/* ═══════════════════════════════════════════════════════════════
   ARCHITECTURE: Three-plane stack with cross-plane connections
   ═══════════════════════════════════════════════════════════════ */
function drawArchitecture(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, scroll: number) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const scale = Math.min(w, h) / 400;
  const offset = scroll * 0.1;

  const planeWidth = 140 * scale;
  const planeHeight = 20 * scale;
  const planeGap = 55 * scale;

  const planes = [
    { label: "data", y: cy - planeGap - offset, color: CYAN },
    { label: "control", y: cy - offset, color: WARM },
    { label: "trust", y: cy + planeGap - offset, color: BRASS },
  ];

  // Draw planes as horizontal layers
  for (const plane of planes) {
    const leftX = cx - planeWidth / 2;
    const rightX = cx + planeWidth / 2;

    // Plane body — gradient fill
    const grad = ctx.createLinearGradient(leftX, plane.y, rightX, plane.y);
    grad.addColorStop(0, rgba(plane.color, 0.02));
    grad.addColorStop(0.3, rgba(plane.color, 0.08));
    grad.addColorStop(0.7, rgba(plane.color, 0.08));
    grad.addColorStop(1, rgba(plane.color, 0.02));
    ctx.fillStyle = grad;
    ctx.fillRect(leftX, plane.y - planeHeight / 2, planeWidth, planeHeight);

    // Plane border
    ctx.strokeStyle = rgba(plane.color, 0.3);
    ctx.lineWidth = 0.8 * scale;
    ctx.strokeRect(leftX, plane.y - planeHeight / 2, planeWidth, planeHeight);

    // Nodes on each plane
    const nodeCount = 5;
    for (let i = 0; i < nodeCount; i++) {
      const nx = leftX + (i + 0.5) * (planeWidth / nodeCount);
      const ny = plane.y + Math.sin(t * 1.5 + i + planes.indexOf(plane)) * 3 * scale;
      ctx.beginPath();
      ctx.arc(nx, ny, 2.5 * scale, 0, Math.PI * 2);
      ctx.fillStyle = rgba(plane.color, 0.6);
      ctx.fill();
    }
  }

  // Cross-plane connections — vertical flowing particles
  for (let i = 0; i < 10; i++) {
    const progress = ((t * 0.35 + i * 0.18) % 1);
    const lane = (i % 5) + 0.5;
    const laneX = cx - planeWidth / 2 + lane * (planeWidth / 5);

    // Flow top to bottom
    const topY = planes[0].y;
    const bottomY = planes[2].y;
    const py = lerp(topY, bottomY, progress);
    const alpha = Math.sin(progress * Math.PI) * 0.5;

    // Color transitions as it passes through planes
    let color: { r: number; g: number; b: number };
    if (progress < 0.33) color = CYAN;
    else if (progress < 0.66) color = lerpColor(CYAN, WARM, (progress - 0.33) / 0.33);
    else color = lerpColor(WARM, BRASS, (progress - 0.66) / 0.34);

    ctx.beginPath();
    ctx.arc(laneX, py, 1.5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = rgba(color, alpha);
    ctx.fill();
  }

  // Vertical guide lines between planes
  ctx.setLineDash([2 * scale, 6 * scale]);
  ctx.lineWidth = 0.4 * scale;
  for (let i = 0; i < 3; i++) {
    const lx = cx - planeWidth * 0.3 + i * planeWidth * 0.3;
    ctx.beginPath();
    ctx.moveTo(lx, planes[0].y + planeHeight / 2);
    ctx.lineTo(lx, planes[2].y - planeHeight / 2);
    ctx.strokeStyle = rgba(BRASS, 0.08);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

/* ═══════════════════════════════════════════════════════════════
   DOCS: Structured data inspection — lines of "code" being
   scanned by a cursor, with evidence fields highlighted
   ═══════════════════════════════════════════════════════════════ */
function drawDocs(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, scroll: number) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const scale = Math.min(w, h) / 400;
  const offset = scroll * 0.08;

  const lineCount = 14;
  const lineHeight = 14 * scale;
  const blockTop = cy - (lineCount * lineHeight) / 2 - offset;
  const blockLeft = cx - 90 * scale;
  const blockWidth = 180 * scale;

  // Background panel — like a terminal window
  ctx.fillStyle = "rgba(12, 14, 18, 0.6)";
  ctx.fillRect(blockLeft - 12 * scale, blockTop - 16 * scale, blockWidth + 24 * scale, lineCount * lineHeight + 32 * scale);
  ctx.strokeStyle = "rgba(120, 191, 231, 0.12)";
  ctx.lineWidth = 0.5 * scale;
  ctx.strokeRect(blockLeft - 12 * scale, blockTop - 16 * scale, blockWidth + 24 * scale, lineCount * lineHeight + 32 * scale);

  // Title bar dots
  const dotY = blockTop - 8 * scale;
  [0, 8, 16].forEach((dx, i) => {
    ctx.beginPath();
    ctx.arc(blockLeft - 4 * scale + dx * scale, dotY, 2 * scale, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? "rgba(220, 80, 80, 0.5)" : i === 1 ? "rgba(220, 180, 60, 0.4)" : "rgba(80, 180, 80, 0.4)";
    ctx.fill();
  });

  // Simulated code lines with varying widths
  const lineLengths = [0.6, 0.85, 0.4, 0.92, 0.7, 0.35, 0.78, 0.55, 0.88, 0.45, 0.72, 0.6, 0.82, 0.5];
  const highlightLines = [1, 3, 6, 8, 12]; // "important" fields

  for (let i = 0; i < lineCount; i++) {
    const ly = blockTop + i * lineHeight;
    const lw = blockWidth * lineLengths[i % lineLengths.length];
    const isHighlighted = highlightLines.includes(i);

    // Line background highlight
    if (isHighlighted) {
      ctx.fillStyle = "rgba(120, 191, 231, 0.04)";
      ctx.fillRect(blockLeft - 4 * scale, ly - 1 * scale, blockWidth + 8 * scale, lineHeight - 2 * scale);
    }

    // Indent marker
    const indent = (i % 3 === 0) ? 0 : (i % 3 === 1) ? 12 * scale : 24 * scale;

    // Line content (stylized rectangles representing text)
    ctx.fillStyle = isHighlighted
      ? rgba(CYAN, 0.45 + Math.sin(t * 2 + i) * 0.1)
      : "rgba(242, 237, 230, 0.12)";
    ctx.fillRect(blockLeft + indent, ly + 3 * scale, lw - indent, 4 * scale);

    // "Key" portion (brighter, shorter)
    if (i % 2 === 0) {
      const keyWidth = 30 * scale + Math.sin(i * 2.3) * 10 * scale;
      ctx.fillStyle = isHighlighted ? rgba(CYAN, 0.6) : rgba(BRASS, 0.25);
      ctx.fillRect(blockLeft + indent, ly + 3 * scale, keyWidth, 4 * scale);
    }
  }

  // Scanning cursor — moves down over time
  const cursorProgress = ((t * 0.25) % 1);
  const cursorY = blockTop + cursorProgress * lineCount * lineHeight;
  ctx.fillStyle = rgba(CYAN, 0.3 + Math.sin(t * 4) * 0.15);
  ctx.fillRect(blockLeft - 8 * scale, cursorY, 2 * scale, lineHeight);

  // Scanning beam across current line
  const beamWidth = blockWidth * 0.7;
  const beamGrad = ctx.createLinearGradient(blockLeft, cursorY, blockLeft + beamWidth, cursorY);
  beamGrad.addColorStop(0, rgba(CYAN, 0.15));
  beamGrad.addColorStop(1, rgba(CYAN, 0));
  ctx.fillStyle = beamGrad;
  ctx.fillRect(blockLeft, cursorY + 2 * scale, beamWidth, lineHeight - 4 * scale);

  // Floating validation checkmarks on the right
  for (let i = 0; i < 4; i++) {
    const checkY = blockTop + highlightLines[i] * lineHeight + 5 * scale;
    const checkX = blockLeft + blockWidth + 16 * scale;
    const alpha = 0.4 + Math.sin(t * 1.5 + i * 1.2) * 0.2;

    // Small check circle
    ctx.beginPath();
    ctx.arc(checkX, checkY, 3 * scale, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(80, 200, 120, ${alpha})`;
    ctx.fill();

    // Checkmark line
    ctx.beginPath();
    ctx.moveTo(checkX - 1.5 * scale, checkY);
    ctx.lineTo(checkX - 0.5 * scale, checkY + 1.5 * scale);
    ctx.lineTo(checkX + 2 * scale, checkY - 1.5 * scale);
    ctx.strokeStyle = `rgba(80, 200, 120, ${alpha + 0.2})`;
    ctx.lineWidth = 0.8 * scale;
    ctx.stroke();
  }

  // Hash chain indicator at bottom
  const hashY = blockTop + lineCount * lineHeight + 12 * scale;
  for (let i = 0; i < 6; i++) {
    const hx = blockLeft + i * 28 * scale;
    const pulse = Math.sin(t * 2 + i * 0.8) * 0.15;
    ctx.fillStyle = rgba(CYAN, 0.2 + pulse);
    ctx.fillRect(hx, hashY, 20 * scale, 3 * scale);
    if (i < 5) {
      ctx.fillStyle = rgba(CYAN, 0.1);
      ctx.fillRect(hx + 21 * scale, hashY + 1 * scale, 5 * scale, 1 * scale);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════════ */
export function HeroVisual({ variant, className = "" }: HeroVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let scrollY = 0;
    let visible = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const drawFn = {
      home: drawHome,
      trace: drawTrace,
      forge: drawForge,
      platform: drawPlatform,
      architecture: drawArchitecture,
      docs: drawDocs,
    }[variant];

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const render = (time: number) => {
      raf = 0;
      if (!visible) return;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const t = reduced ? 1 : time * 0.001;

      ctx.clearRect(0, 0, w, h);
      drawFn(ctx, w, h, t, scrollY);

      if (!reduced) raf = requestAnimationFrame(render);
    };

    const onScroll = () => {
      scrollY = window.scrollY;
      if (!raf && visible) raf = requestAnimationFrame(render);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(render);
    });

    resize();
    observer.observe(canvas);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    raf = requestAnimationFrame(render);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
