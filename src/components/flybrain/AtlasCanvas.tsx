"use client";

// Atlas interaktif: klik neuron → detail. Posisi statis per-region + pulsa.

import { useEffect, useRef } from "react";
import { buildAtlas } from "@/lib/flybrain/connectome";
import type { Neuron } from "@/lib/flybrain/types";
interface Props {
  height?: number;
  selected: Neuron | null;
  onSelect: (n: Neuron | null) => void;
}

export function AtlasCanvas({ height = 460, selected, onSelect }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const hoverRef = useRef<number | null>(null);
  const selectRef = useRef(onSelect);
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);
  const selectedId = selected?.id ?? -1;
  const stateRef = useRef<{ nodes: { X: number; Y: number; id: number }[] }>({ nodes: [] });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const atlas = buildAtlas();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let raf = 0;
    let dead = false;
    let t = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const pulses: { e: number; p: number }[] = [];
    for (let i = 0; i < 46; i++) pulses.push({ e: Math.floor(Math.random() * atlas.edges.length), p: Math.random() });

    const frame = () => {
      if (dead) return;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      t += reduced ? 0 : 0.02;

      // skala: muatkan otak (bidang 1000x620) ke kanvas
      const s = Math.min(w / 1040, h / 640);
      const ox = (w - 1000 * s) / 2;
      const oy = (h - 620 * s) / 2;
      const nodes = atlas.neurons.map((n) => ({ X: ox + n.x * s, Y: oy + n.y * s, id: n.id }));
      stateRef.current.nodes = nodes;

      // edges
      ctx.lineWidth = 0.6;
      for (const e of atlas.edges) {
        const a = nodes[e.a];
        const b = nodes[e.b];
        ctx.strokeStyle = `hsla(140, 65%, 55%, ${0.05 + e.w * 0.08})`;
        ctx.beginPath();
        ctx.moveTo(a.X, a.Y);
        ctx.lineTo(b.X, b.Y);
        ctx.stroke();
      }

      // pulses
      for (const p of pulses) {
        if (!reduced) p.p += 0.01 + Math.random() * 0.01;
        if (p.p >= 1) {
          p.p = 0;
          p.e = Math.floor(Math.random() * atlas.edges.length);
        }
        const e = atlas.edges[p.e];
        const a = nodes[e.a];
        const b = nodes[e.b];
        const px = a.X + (b.X - a.X) * p.p;
        const py = a.Y + (b.Y - a.Y) * p.p;
        ctx.fillStyle = "rgba(190,255,210,0.9)";
        ctx.beginPath();
        ctx.arc(px, py, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // nodes
      const hover = hoverRef.current;
      for (const n of atlas.neurons) {
        const p = nodes[n.id];
        const region = atlas.regions.find((r) => r.key === n.region);
        const isSel = selectedId === n.id;
        const isHover = hover === n.id;
        const breathe = 0.5 + 0.5 * Math.sin(t * 1.4 + n.id * 0.7);
        const radius = isSel || isHover ? 5.5 : 2 + n.degree * 0.22 + (reduced ? 0 : breathe * 0.4);
        ctx.fillStyle = isSel || isHover
          ? "rgba(251,191,36,0.95)"
          : `hsla(${region?.hue ?? 140}, 75%, ${55 + breathe * 8}%, 0.85)`;
        ctx.beginPath();
        ctx.arc(p.X, p.Y, radius, 0, Math.PI * 2);
        ctx.fill();
        if (isSel) {
          ctx.strokeStyle = "rgba(251,191,36,0.8)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.X, p.Y, 10 + 2 * Math.sin(t * 3), 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.restore();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onMove = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      let best: number | null = null;
      let bd = 14 * 14;
      for (const n of stateRef.current.nodes) {
        const d = (n.X - mx) ** 2 + (n.Y - my) ** 2;
        if (d < bd) {
          bd = d;
          best = n.id;
        }
      }
      hoverRef.current = best;
    };
    const onClick = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      let best: number | null = null;
      let bd = 16 * 16;
      for (const n of stateRef.current.nodes) {
        const d = (n.X - mx) ** 2 + (n.Y - my) ** 2;
        if (d < bd) {
          bd = d;
          best = n.id;
        }
      }
      selectRef.current(best === null ? null : atlas.neurons[best]);
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("click", onClick);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("click", onClick);
    };
  }, [selectedId, height]);

  return (
    <canvas
      ref={ref}
      style={{ width: "100%", height }}
      className="cursor-crosshair"
      aria-label="Atlas connectome interaktif — klik neuron untuk detail"
      role="img"
    />
  );
}
