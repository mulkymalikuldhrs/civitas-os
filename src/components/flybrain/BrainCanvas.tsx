"use client";

// Kanvas hero: jaringan neuron hidup (proyeksi pseudo-3D + pulsa sinyal).
// Menggambar atlas deterministik dari kernel — bukan video, bukan gambar statis.

import { useEffect, useRef } from "react";
import { buildAtlas } from "@/lib/flybrain/connectome";

interface Props {
  height?: number;
  intensity?: number; // 0..1 — kepadatan pulsa
  spin?: boolean;
}

interface P3 {
  x: number;
  y: number;
  z: number;
  hue: number;
}

export function BrainCanvas({ height = 380, intensity = 0.5, spin = true }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const atlas = buildAtlas();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes: P3[] = atlas.neurons.map((n) => ({
      x: n.x - 500,
      y: n.y - 310,
      z: ((n.id * 7919) % 260) - 130,
      hue: atlas.regions.find((r) => r.key === n.region)?.hue ?? 140,
    }));

    let raf = 0;
    let t = 0;
    let dead = false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const pulses: { e: number; p: number }[] = [];
    for (let i = 0; i < Math.floor(atlas.edges.length * intensity * 0.25); i++) {
      pulses.push({ e: Math.floor(Math.random() * atlas.edges.length), p: Math.random() });
    }

    const frame = () => {
      if (dead) return;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      t += reduced ? 0 : 0.0035;
      const ry = spin ? Math.sin(t * 0.9) * 0.55 : 0;
      const rx = spin ? Math.cos(t * 0.7) * 0.12 : 0;
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);

      const proj = nodes.map((n) => {
        const x1 = n.x * cosY - n.z * sinY;
        const z1 = n.x * sinY + n.z * cosY;
        const y1 = n.y * cosX - z1 * sinX;
        const z2 = n.y * sinX + z1 * cosX;
        const scale = 640 / (640 + z2);
        return {
          X: w / 2 + x1 * scale,
          Y: h / 2 + y1 * scale,
          S: scale,
          hue: n.hue,
        };
      });

      // edges
      ctx.lineWidth = 0.55;
      for (const e of atlas.edges) {
        const a = proj[e.a];
        const b = proj[e.b];
        if (!a || !b) continue;
        const depth = (a.S + b.S) / 2;
        ctx.strokeStyle = `hsla(${(a.hue + b.hue) / 2}, 70%, 60%, ${0.05 + (depth - 0.7) * 0.16 * e.w})`;
        ctx.beginPath();
        ctx.moveTo(a.X, a.Y);
        ctx.lineTo(b.X, b.Y);
        ctx.stroke();
      }

      // pulses
      for (const p of pulses) {
        if (!reduced) p.p += 0.008 + Math.random() * 0.012;
        if (p.p >= 1) {
          p.p = 0;
          p.e = Math.floor(Math.random() * atlas.edges.length);
        }
        const e = atlas.edges[p.e];
        const a = proj[e.a];
        const b = proj[e.b];
        if (!a || !b) continue;
        const px = a.X + (b.X - a.X) * p.p;
        const py = a.Y + (b.Y - a.Y) * p.p;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, 5);
        grad.addColorStop(0, "rgba(190, 255, 210, 0.95)");
        grad.addColorStop(1, "rgba(74, 222, 128, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // nodes
      for (const p of proj) {
        const r = Math.max(0.6, p.S * 1.5);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 62%, ${0.35 + (p.S - 0.7) * 0.9})`;
        ctx.beginPath();
        ctx.arc(p.X, p.Y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [height, intensity, spin]);

  return <canvas ref={ref} style={{ width: "100%", height }} aria-label="Visualisasi jaringan neuron hidup" role="img" />;
}
