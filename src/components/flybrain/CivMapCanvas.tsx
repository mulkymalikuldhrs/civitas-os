"use client";

// CIVITAS OS — CivMapCanvas.tsx
// Peta peradaban hidup (world layer visual): istana, menara kas, kantor perusahaan,
// pasar, agen bergerak, denyut. Kejujuran visual: perusahaan PROPOSED = kerangka putus-putus
// (belum berdiri), bukan bangunan penuh.

import { useEffect, useRef } from "react";

export interface MapEntity {
  mcType: string;
  mcName: string;
  civCode: string;
  coords: { x?: number; z?: number };
}

export interface MapOrg {
  code: string;
  lifecycle: string;
}

interface Props {
  entities: MapEntity[];
  orgs: MapOrg[];
  pulseAt: number; // timestamp denyut terakhir (ms epoch) — memicu gelombang
  agentCount: number;
}

const LC_COLOR: Record<string, string> = {
  PROPOSED: "#6b7f74",
  REGISTERED: "#7fda9a",
  CAPITALIZED: "#4ade80",
  ACTIVE: "#4ade80",
  GROWING: "#34d399",
  PROFITABLE: "#fbbf24",
  UNPROFITABLE: "#fb923c",
  CAPITAL_CONSTRAINED: "#f87171",
  DORMANT: "#94a3b8",
  RESTRUCTURING: "#fbbf24",
  LIQUIDATING: "#f87171",
  BANKRUPT: "#ef4444",
  DISSOLVED: "#64748b",
};

export function CivMapCanvas({ entities, orgs, pulseAt, agentCount }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ entities, orgs, pulseAt, agentCount });

  useEffect(() => {
    stateRef.current = { entities, orgs, pulseAt, agentCount };
  }, [entities, orgs, pulseAt, agentCount]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;

    const lifecycle = (code: string) => stateRef.current.orgs.find((o) => o.code === code)?.lifecycle ?? "PROPOSED";

    const draw = (t: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // Latar grid
      ctx.fillStyle = "#050b08";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#0c1a12";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 26) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 26) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      const scale = Math.min(W / 110, H / 90);
      const cx = W / 2;
      const cy = H / 2 - 10;
      const px = (wx: number) => cx + wx * scale;
      const py = (wz: number) => cy + wz * scale;

      // Jalan utama
      ctx.strokeStyle = "#12261b";
      ctx.lineWidth = Math.max(6, scale * 1.4);
      ctx.beginPath();
      ctx.moveTo(px(-46), py(10));
      ctx.lineTo(px(46), py(10));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px(0), py(-30));
      ctx.lineTo(px(0), py(30));
      ctx.stroke();

      // Denyut: gelombang dari pusat kota
      const pulse = stateRef.current.pulseAt;
      if (pulse > 0) {
        const age = (Date.now() - pulse) % 4200;
        const p = age / 4200;
        ctx.strokeStyle = `rgba(74,222,128,${0.42 * (1 - p)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px(0), py(0), p * scale * 46, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Entitas dunia
      for (const e of stateRef.current.entities) {
        const x = px(e.coords.x ?? 0);
        const y = py(e.coords.z ?? 0);
        const lc = lifecycle(e.civCode);
        const color = e.mcType === "BUILDING" && e.civCode.startsWith("COMP") ? (LC_COLOR[lc] ?? "#4ade80") : e.civCode === "GOV" ? "#fbbf24" : e.civCode === "NUSANTARA" ? "#4ade80" : "#38bdf8";
        const unplanned = e.civCode.startsWith("COMP") && (lc === "PROPOSED" || lc === "DISSOLVED");

        if (e.mcType === "DISTRICT") {
          ctx.strokeStyle = "rgba(56,189,248,0.35)";
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 1.4;
          ctx.strokeRect(x - scale * 34, y - scale * 26, scale * 68, scale * 52);
          ctx.setLineDash([]);
          ctx.fillStyle = "rgba(56,189,248,0.8)";
          ctx.font = "9px ui-monospace, monospace";
          ctx.fillText(e.mcName.toUpperCase(), x - scale * 30, y - scale * 28);
          continue;
        }

        const bw = e.mcType === "BUILDING" ? scale * 7 : scale * 5;
        const bh = e.mcType === "BUILDING" ? scale * 7 : scale * 5;

        if (unplanned) {
          // Belum berdiri: kerangka putus-putus (kejujuran visual)
          ctx.strokeStyle = color;
          ctx.setLineDash([3, 3]);
          ctx.globalAlpha = 0.55;
          ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = "rgba(18,38,27,0.9)";
          ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.6;
          ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
          // Cahaya jendela bernapas
          const glow = 0.35 + 0.3 * Math.sin(t / 620 + x * 0.05);
          ctx.fillStyle = color;
          ctx.globalAlpha = glow;
          ctx.fillRect(x - bw / 2 + 2, y - bh / 2 + 2, Math.max(2, bw * 0.22), Math.max(2, bh * 0.22));
          ctx.fillRect(x + bw / 2 - 2 - bw * 0.22, y - bh / 2 + 2, Math.max(2, bw * 0.22), Math.max(2, bh * 0.22));
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = "rgba(190,232,204,0.85)";
        ctx.font = "8.5px ui-monospace, monospace";
        const label = e.mcName.length > 22 ? `${e.mcName.slice(0, 21)}…` : e.mcName;
        ctx.fillText(label, x - bw / 2, y + bh / 2 + 10);
      }

      // Agen: titik-titik bergerak di sepanjang jalan utama
      const n = Math.min(stateRef.current.agentCount, 26);
      for (let i = 0; i < n; i++) {
        const phase = t / 2400 + i * 1.31;
        const lane = i % 2 === 0 ? 10 : 13.5;
        const wx = ((Math.sin(phase) + 1) / 2) * 84 - 42;
        const wz = lane * (i % 3 === 0 ? -1 : 1) + 4 * Math.cos(phase * 2 + i);
        const ax = px(wx);
        const ay = py(wz);
        ctx.fillStyle = i % 5 === 0 ? "#fbbf24" : "#4ade80";
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(ax, ay, 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Kompas kecil
      ctx.fillStyle = "rgba(127,154,137,0.8)";
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillText("UTARA ↑ · skala petakan rencana kota", 10, H - 10);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="w-full h-[380px] rounded-md border border-border" role="img" aria-label="Peta peradaban Nusantara Digital" />;
}
