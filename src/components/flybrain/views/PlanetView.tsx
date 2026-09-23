"use client";

// 08 PLANET — peta dunia hidup (12_ECOSYSTEM.md §5).
// SATU-SATUNYA kanvas dengan RAF loop di seluruh app (konstitusi hukum 6):
//   • band langit konnektom (182 bintang = neuron atlas),
//   • 8 biome sebagai region organik (bezier blob — bukan kotak),
//   • partikel cuaca + siklus siang-malam (lerp tint),
//   • 6 creature sebagai sprite (ikon lucide dinamis + trail memudar + gerak
//     smooth — posisi target dari worldTick, UI yang lerp-kan per frame).
// Semua angka = data nyata store (zero-storage; dunia persist di settings lokal).
// Interaksi: klik biome → inspektor + tombol "Buka fitur"; klik creature →
// inspektor; PETA SISTEM (wire table §1) klik → highlight di kanvas.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bug,
  Building2,
  FlaskConical,
  Hammer,
  Microscope,
  Moon,
  Mountain,
  PenLine,
  Snowflake,
  Sparkles,
  Sprout,
  TreePine,
  TrendingUp,
  Waves,
  Wheat,
  Zap,
} from "lucide-react";
import { useFlybrain, type ViewKey } from "@/lib/flybrain/store";
import { CREATURES } from "@/lib/flybrain/organism/creatures";
import type { CreatureState } from "@/lib/flybrain/organism/creature";
import { immune } from "@/lib/flybrain/organism/organs/immune";
import type { ReflectReport } from "@/lib/flybrain/organism/selfReflect";
import { buildAtlas } from "@/lib/flybrain/connectome";
import { BIOMES, WIRE_TABLE, worldSnapshot, BIOME_CENTER } from "@/lib/flybrain/ecosystem/world";
import { jamLabel } from "@/lib/flybrain/ecosystem/climate";
import type { BiomeId, WorldState } from "@/lib/flybrain/ecosystem/types";

const BIOME_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  TreePine,
  Waves,
  Mountain,
  Building2,
  Wheat,
  FlaskConical,
  Sparkles,
  Snowflake,
};

const CREATURE_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Bug,
  TrendingUp,
  PenLine,
  Microscope,
  Sprout,
  Hammer,
};

const VIEW_LABEL: Record<ViewKey, string> = {
  civitas: "00 CIVITAS",
  kendali: "01 Kendali",
  otak: "02 Otak",
  prt: "03 PRT",
  vault: "04 Vault",
  gerbang: "05 Gerbang",
  dokumen: "06 Dokumen",
  ruang: "07 Ruang Kendali",
  biosfer: "08 BIOSFER",
  planet: "09 Planet",
  peradaban: "10 Peradaban+",
  minecraft: "11 Minecraft",
};

const MOOD_LABEL: Record<string, string> = {
  bekerja: "BEKERJA",
  tidur: "TIDUR",
  migrasi: "MIGRASI",
  lapar: "LAPAR",
};

// ---------------------------------------------------------------------------
// Kanvas planet — SATU RAF loop
// ---------------------------------------------------------------------------

interface PlanetCanvasProps {
  world: WorldState | null;
  creatures: CreatureState[];
  selectedBiome: BiomeId | null;
  selectedCreature: string | null;
  highlightBiome: BiomeId | null;
  quantVolatility: number;
  breakerOpen: number;
  vetoRecent: boolean;
  decideRecent: boolean;
  reflectVerdict?: ReflectReport | null;
  onSelectBiome: (b: BiomeId | null) => void;
  onSelectCreature: (id: string | null) => void;
}

function mulberry32(seed: number): () => number {
  // mulberry32 kanonik (Math.imul 2-arg — perbaikan TS2554: argumen kedua hilang;
  // tetap deterministik untuk seed yang sama)
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function PlanetCanvas(props: PlanetCanvasProps) {
  const { world, creatures, onSelectBiome, onSelectCreature } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // stateRef = bacaan RAF selalu fresh tanpa membangun ulang loop.
  const stateRef = useRef(props);
  useEffect(() => {
    stateRef.current = props;
  });
  const dispRef = useRef<Record<string, { x: number; y: number }>>({});
  const sizeRef = useRef({ w: 0, h: 0 });
  const tintRef = useRef({ r: 11, g: 26, b: 42, a: 0 });
  const flashRef = useRef({ next: 0, until: 0 });
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number }[]>([]);
  const decorRef = useRef<{
    trees: { dx: number; dy: number; s: number }[];
    peaks: { dx: number; w: number; h: number }[];
    buildings: { dx: number; w: number; h: number }[];
    tufts: { dx: number; dy: number; s: number }[];
    blob: Record<string, number[]>;
  }>({ trees: [], peaks: [], buildings: [], tufts: [], blob: {} });

  // Dekorasi deterministik per biome (seeded — bentuk blob stabil antar render).
  useEffect(() => {
    const blob: Record<string, number[]> = {};
    BIOMES.forEach((b, bi) => {
      const rnd = mulberry32(0x9e3779b9 ^ (bi * 2654435761));
      blob[b.id] = Array.from({ length: 12 }, () => 0.78 + rnd() * 0.44);
    });
    const tr = mulberry32(101);
    const trees = Array.from({ length: 10 }, () => ({ dx: (tr() * 2 - 1) * 0.62, dy: (tr() * 2 - 1) * 0.4, s: 0.6 + tr() * 0.8 }));
    const pr = mulberry32(202);
    const peaks = Array.from({ length: 3 }, (_, i) => ({ dx: -0.45 + i * 0.42 + (pr() - 0.5) * 0.1, w: 0.5 + pr() * 0.2, h: 0.55 + pr() * 0.45 }));
    const br = mulberry32(303);
    const buildings = Array.from({ length: 5 }, (_, i) => ({ dx: -0.5 + i * 0.24, w: 0.14 + br() * 0.08, h: 0.3 + br() * 0.6 }));
    const gr = mulberry32(404);
    const tufts = Array.from({ length: 14 }, () => ({ dx: (gr() * 2 - 1) * 0.66, dy: (gr() * 2 - 1) * 0.42, s: 0.5 + gr() * 0.9 }));
    decorRef.current = { trees, peaks, buildings, tufts, blob };
    // Partikel cuaca (visual — acak diperbolehkan, spesifikasi §C).
    particlesRef.current = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.02,
      vy: 0.02 + Math.random() * 0.06,
    }));
  }, []);

  // RAF loop — pause saat tab hidden (visibilitychange), bersih saat unmount.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const atlas = buildAtlas();
    let raf = 0;
    let last = performance.now();
    let running = true;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const blobPath = (id: string, cx: number, cy: number, rPx: number, squash: number) => {
      const mult = decorRef.current.blob[id] ?? Array.from({ length: 12 }, () => 1);
      const pts = mult.map((m, i) => {
        const a = (i / mult.length) * Math.PI * 2;
        return { x: cx + Math.cos(a) * rPx * m, y: cy + Math.sin(a) * rPx * m * squash };
      });
      ctx.beginPath();
      const mid = (p: { x: number; y: number }, q: { x: number; y: number }) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
      const m0 = mid(pts[11], pts[0]);
      ctx.moveTo(m0.x, m0.y);
      for (let i = 0; i < 12; i++) {
        const q = pts[(i + 1) % 12];
        const m = mid(pts[i], q);
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
      }
      ctx.closePath();
    };

    const hex = (h: string): [number, number, number] => [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
    ];

    const draw = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const st = stateRef.current;
      const { w, h } = sizeRef.current;
      const worldNow = st.world;
      const skyH = h * 0.235;
      const squash = 0.72;

      // ---- posisi display: lerp ke posisi target worldTick ----
      if (worldNow) {
        for (const c of Object.values(worldNow.creatures)) {
          const cur = dispRef.current[c.id] ?? { x: c.x, y: c.y };
          const k = Math.min(1, dt * 2.2);
          cur.x += (c.x - cur.x) * k;
          cur.y += (c.y - cur.y) * k;
          dispRef.current[c.id] = cur;
        }
      }

      // ---- tanah ----
      const landGrad = ctx.createLinearGradient(0, skyH, 0, h);
      landGrad.addColorStop(0, "#0a130e");
      landGrad.addColorStop(1, "#070f0a");
      ctx.fillStyle = landGrad;
      ctx.fillRect(0, skyH, w, h - skyH);

      // ---- band langit konnektom (bintang = neuron; bima sakti = sinaps) ----
      const skyGrad = ctx.createLinearGradient(0, 0, 0, skyH);
      skyGrad.addColorStop(0, "#0b1220");
      skyGrad.addColorStop(1, "#0a1410");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, skyH);
      ctx.strokeStyle = "#1b2f24";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, skyH);
      ctx.lineTo(w, skyH);
      ctx.stroke();

      // bima sakti: jalur sinaps samar
      ctx.strokeStyle = "rgba(192,132,252,0.07)";
      for (let i = 0; i < atlas.edges.length; i += 2) {
        const e = atlas.edges[i];
        const a = atlas.neurons[e.a];
        const b = atlas.neurons[e.b];
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo((a.x / 1000) * w, (a.y / 620) * skyH * 0.92 + skyH * 0.04);
        ctx.lineTo((b.x / 1000) * w, (b.y / 620) * skyH * 0.92 + skyH * 0.04);
        ctx.stroke();
      }
      // bintang = neuron (berkedip; konstelasi berpendar saat keputusan/inspeksi)
      for (let i = 0; i < atlas.neurons.length; i++) {
        const n = atlas.neurons[i];
        const sx = (n.x / 1000) * w;
        const sy = (n.y / 620) * skyH * 0.92 + skyH * 0.04;
        const tw = 0.5 + 0.5 * Math.sin(now * 0.0012 + i * 1.7);
        let alpha = 0.22 + tw * 0.5;
        if (st.decideRecent) alpha = Math.min(1, alpha + 0.3);
        ctx.fillStyle = `rgba(226,232,240,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.8 + (n.degree % 3) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- 7 biome daratan sebagai blob organik ----
      const land = BIOMES.filter((b) => b.id !== "langit");
      for (const b of land) {
        const c = BIOME_CENTER[b.id];
        const cx = c.x * w;
        const cy = c.y * h;
        const rPx = c.r * w;
        const stB = worldNow?.biomes[b.id];
        const selected = st.selectedBiome === b.id;
        const highlighted = st.highlightBiome === b.id;
        const [r, g, bl] = hex(b.color);

        blobPath(b.id, cx, cy, rPx, squash);
        const fillGrad = ctx.createRadialGradient(cx, cy, rPx * 0.1, cx, cy, rPx);
        fillGrad.addColorStop(0, `rgba(${r},${g},${bl},${(0.13 + (stB ? stB.energi / 100 : 0.5) * 0.14).toFixed(3)})`);
        fillGrad.addColorStop(1, `rgba(${r},${g},${bl},0.03)`);
        ctx.fillStyle = fillGrad;
        ctx.fill();
        ctx.lineWidth = selected || highlighted ? 2 : 1.2;
        ctx.strokeStyle = selected
          ? `rgba(${r},${g},${bl},0.95)`
          : highlighted
            ? `rgba(${r},${g},${bl},0.8)`
            : `rgba(${r},${g},${bl},0.34)`;
        if (highlighted && !selected) {
          ctx.setLineDash([6, 5]);
          ctx.lineDashOffset = -(now * 0.02) % 11;
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // label + bar energi mini
        ctx.font = "600 9px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(${r},${g},${bl},0.92)`;
        ctx.fillText(b.nama.toUpperCase(), cx, cy - rPx * squash * 0.78);
        if (stB) {
          const bw = 34;
          ctx.fillStyle = "rgba(7,13,10,0.75)";
          ctx.fillRect(cx - bw / 2, cy - rPx * squash * 0.78 + 5, bw, 3);
          ctx.fillStyle = b.color;
          ctx.fillRect(cx - bw / 2, cy - rPx * squash * 0.78 + 5, (bw * stB.energi) / 100, 3);
        }
        ctx.textAlign = "left";

        // ---- detail hidup per biome (data-driven) ----
        const t = now * 0.001;
        if (b.id === "hutan" && stB) {
          const n = 3 + Math.floor((stB.fertility / 100) * 7);
          for (let i = 0; i < Math.min(n, decorRef.current.trees.length); i++) {
            const tr = decorRef.current.trees[i];
            const tx = cx + tr.dx * rPx;
            const ty = cy + tr.dy * rPx * squash;
            const sway = Math.sin(t * 1.4 + i) * 1.5;
            const th = rPx * 0.2 * tr.s;
            ctx.strokeStyle = "rgba(74,222,128,0.55)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx, ty - th);
            ctx.moveTo(tx - th * 0.42 + sway, ty - th * 0.45);
            ctx.lineTo(tx, ty - th);
            ctx.lineTo(tx + th * 0.42 + sway, ty - th * 0.45);
            ctx.stroke();
          }
        }
        if (b.id === "samudra" && stB) {
          for (let wl = 0; wl < 3; wl++) {
            ctx.strokeStyle = `rgba(56,189,248,${(0.16 + (stB.energi / 100) * 0.3).toFixed(3)})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (let px = -rPx * 0.75; px <= rPx * 0.75; px += 4) {
              const py = cy - rPx * 0.25 + wl * rPx * 0.22 + Math.sin(px * 0.09 + t * (2 + wl)) * 2.2;
              if (px === -rPx * 0.75) ctx.moveTo(cx + px, py);
              else ctx.lineTo(cx + px, py);
            }
            ctx.stroke();
          }
        }
        if (b.id === "gunung") {
          const snowy = st.quantVolatility > 0.45;
          for (let i = 0; i < decorRef.current.peaks.length; i++) {
            const p = decorRef.current.peaks[i];
            const shift = Math.sin(t * 0.35 + i * 2) * rPx * 0.05; // puncak bergeser tiap tick
            const px = cx + (p.dx + shift / rPx) * rPx;
            const ph = rPx * 0.42 * p.h;
            const pw = rPx * 0.34 * p.w;
            ctx.fillStyle = "rgba(203,213,225,0.16)";
            ctx.strokeStyle = "rgba(203,213,225,0.5)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px - pw, cy + rPx * 0.3);
            ctx.lineTo(px, cy + rPx * 0.3 - ph);
            ctx.lineTo(px + pw, cy + rPx * 0.3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            if (snowy) {
              ctx.fillStyle = "rgba(248,250,252,0.55)";
              ctx.beginPath();
              ctx.moveTo(px - pw * 0.3, cy + rPx * 0.3 - ph * 0.72);
              ctx.lineTo(px, cy + rPx * 0.3 - ph);
              ctx.lineTo(px + pw * 0.3, cy + rPx * 0.3 - ph * 0.72);
              ctx.closePath();
              ctx.fill();
            }
          }
        }
        if (b.id === "kota" && stB) {
          const skills = st.creatures.reduce((a, cr) => a + cr.skills.length, 0);
          for (let i = 0; i < decorRef.current.buildings.length; i++) {
            const bd = decorRef.current.buildings[i];
            const bx = cx + bd.dx * rPx;
            const bh = rPx * 0.36 * bd.h + Math.min(skills, 8) * 1.2;
            const bw = rPx * 0.16 * bd.w + 4;
            ctx.fillStyle = "rgba(251,191,36,0.14)";
            ctx.fillRect(bx - bw / 2, cy + rPx * 0.28 - bh, bw, bh);
            ctx.strokeStyle = "rgba(251,191,36,0.45)";
            ctx.lineWidth = 1;
            ctx.strokeRect(bx - bw / 2, cy + rPx * 0.28 - bh, bw, bh);
            const lit = Math.min(skills, 12);
            ctx.fillStyle = "rgba(253,230,138,0.85)";
            for (let wnd = 0; wnd < lit; wnd++) {
              const wx = bx - bw / 2 + 2 + ((wnd * 7) % Math.max(1, bw - 5));
              const wy = cy + rPx * 0.28 - bh + 3 + ((wnd * 5) % Math.max(1, bh - 8));
              if (wy < cy + rPx * 0.28 - 2) ctx.fillRect(wx, wy, 1.6, 1.6);
            }
          }
        }
        if (b.id === "savana" && stB) {
          const musimSekarang = worldNow?.climate.musim ?? "kemarau";
          const hue = musimSekarang === "hujan" ? "74,222,128" : musimSekarang === "kemarau" ? "163,230,53" : "161,124,60";
          for (let i = 0; i < decorRef.current.tufts.length; i++) {
            const tf = decorRef.current.tufts[i];
            const gx = cx + tf.dx * rPx;
            const gy = cy + tf.dy * rPx * squash;
            const gh = rPx * 0.1 * tf.s;
            ctx.strokeStyle = `rgba(${hue},0.5)`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(gx, gy + gh);
            ctx.quadraticCurveTo(gx + Math.sin(t + i) * 2, gy - gh * 0.4, gx + Math.sin(t + i) * 3.5, gy - gh);
            ctx.stroke();
          }
          if (stB.energi > 68) {
            // panen = partikel emas (aktivitas kwitansi/ledger tinggi)
            ctx.fillStyle = "rgba(250,204,21,0.7)";
            for (let i = 0; i < 6; i++) {
              const a = t * 0.8 + i * 1.05;
              ctx.beginPath();
              ctx.arc(cx + Math.cos(a) * rPx * 0.45, cy + Math.sin(a * 1.3) * rPx * 0.28 - rPx * 0.1, 1.4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        if (b.id === "kawah" && stB) {
          const pulse = 0.3 + 0.25 * Math.sin(t * 2);
          ctx.fillStyle = `rgba(167,139,250,${(st.reflectVerdict?.verdict === "critical" ? 0.08 : pulse).toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rPx * 0.34, rPx * 0.24, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(167,139,250,0.55)";
          ctx.lineWidth = 1.4;
          ctx.stroke();
          if (st.reflectVerdict?.verdict === "critical") {
            // asap hitam saat verdict critical
            for (let i = 0; i < 4; i++) {
              const sy = ((t * 12 + i * 22) % (rPx * 0.7));
              ctx.fillStyle = `rgba(30,30,36,${(0.5 - sy / (rPx * 0.7) * 0.4).toFixed(3)})`;
              ctx.beginPath();
              ctx.arc(cx + Math.sin(t + i * 2) * 6, cy - sy, 3 + i, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        if (b.id === "kutub" && stB) {
          ctx.fillStyle = "rgba(226,232,240,0.2)";
          ctx.beginPath();
          ctx.ellipse(cx, cy + rPx * 0.08, rPx * 0.62, rPx * 0.3 * squash + 6, 0, 0, Math.PI * 2);
          ctx.fill();
          const open = st.breakerOpen;
          if (open > 0) {
            // retakan merah saat breaker terbuka
            ctx.strokeStyle = "rgba(248,113,113,0.85)";
            ctx.lineWidth = 1.3;
            for (let i = 0; i < Math.min(3, open); i++) {
              ctx.beginPath();
              ctx.moveTo(cx - rPx * 0.4 + i * rPx * 0.35, cy - 4);
              ctx.lineTo(cx - rPx * 0.28 + i * rPx * 0.35, cy + 4);
              ctx.lineTo(cx - rPx * 0.34 + i * rPx * 0.35, cy + 12);
              ctx.stroke();
            }
          }
          if (st.vetoRecent) {
            // aurora saat veto menolak aksi
            ctx.strokeStyle = "rgba(110,231,160,0.35)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (let px = -rPx * 0.6; px <= rPx * 0.6; px += 4) {
              const py = cy - rPx * 0.55 + Math.sin(px * 0.12 + t * 2) * 4;
              if (px === -rPx * 0.6) ctx.moveTo(cx + px, py);
              else ctx.lineTo(cx + px, py);
            }
            ctx.stroke();
          }
        }
      }

      // ---- partikel cuaca (visual) ----
      const cuaca = worldNow?.climate.cuaca ?? "cerah";
      const musim = worldNow?.climate.musim ?? "kemarau";
      const angin = worldNow?.climate.angin ?? false;
      const parts = particlesRef.current;
      for (const p of parts) {
        if (cuaca === "badai") {
          p.y += p.vy * dt * 7;
          p.x += (angin ? 0.06 : 0.01) * dt;
          ctx.strokeStyle = "rgba(148,197,180,0.4)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x * w, p.y * h);
          ctx.lineTo(p.x * w - 2, p.y * h - 9);
          ctx.stroke();
        } else if (musim === "hujan" || cuaca === "berawan") {
          p.y += p.vy * dt * 1.6;
          p.x += p.vx * dt;
          ctx.fillStyle = "rgba(148,197,180,0.14)";
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        if (angin) {
          p.x += 0.045 * dt;
          ctx.strokeStyle = "rgba(191,232,204,0.1)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x * w, p.y * h);
          ctx.lineTo(p.x * w + 14, p.y * h);
          ctx.stroke();
        }
        if (p.y > 1.02 || p.x > 1.05) {
          p.x = Math.random() * 1.1 - 0.1;
          p.y = -0.02;
          p.vy = 0.02 + Math.random() * 0.06;
        }
        if (p.x > 1.05) p.x = -0.05;
      }
      // petir: kilat sesekali saat badai
      if (cuaca === "badai") {
        if (now > flashRef.current.next) {
          flashRef.current = { next: now + 2200 + Math.random() * 4200, until: now + 130 };
        }
        if (now < flashRef.current.until) {
          ctx.fillStyle = "rgba(226,232,240,0.12)";
          ctx.fillRect(0, 0, w, h);
        }
      }

      // ---- tint siang-malam (lerp warna langit) ----
      const fase = worldNow?.climate.fase ?? "siang";
      const target =
        fase === "malam"
          ? { r: 11, g: 26, b: 42, a: 0.38 }
          : fase === "senja"
            ? { r: 124, g: 45, b: 18, a: 0.2 }
            : fase === "fajar"
              ? { r: 180, g: 83, b: 9, a: 0.16 }
              : { r: 11, g: 26, b: 42, a: 0 };
      const tint = tintRef.current;
      const lk = Math.min(1, dt * 1.6);
      tint.r += (target.r - tint.r) * lk;
      tint.g += (target.g - tint.g) * lk;
      tint.b += (target.b - tint.b) * lk;
      tint.a += (target.a - tint.a) * lk;
      ctx.fillStyle = `rgba(${tint.r.toFixed(0)},${tint.g.toFixed(0)},${tint.b.toFixed(0)},${tint.a.toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);

      // ---- trail + sprite creature (canvas) ----
      if (worldNow) {
        for (const meta of CREATURES) {
          const wc = worldNow.creatures[meta.id];
          if (!wc) continue;
          const [cr, cg, cb] = hex(meta.color);
          // trail memudar
          for (let i = 0; i < wc.trail.length; i++) {
            const tp = wc.trail[i];
            const age = (i + 1) / (wc.trail.length + 1);
            ctx.fillStyle = `rgba(${cr},${cg},${cb},${(age * 0.34).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(tp.x * w, tp.y * h, 1.6, 0, Math.PI * 2);
            ctx.fill();
          }
          // glow + titik
          const disp = dispRef.current[meta.id] ?? { x: wc.x, y: wc.y };
          const px = disp.x * w;
          const py = disp.y * h;
          const glow = ctx.createRadialGradient(px, py, 1, px, py, 13);
          glow.addColorStop(0, `rgba(${cr},${cg},${cb},0.5)`);
          glow.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(px, py, 13, 0, Math.PI * 2);
          ctx.fill();
          const live = st.creatures.find((c) => c.id === meta.id);
          const dim = live?.status !== "aktif" || wc.mood === "tidur";
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${dim ? 0.45 : 0.95})`;
          ctx.beginPath();
          ctx.arc(px, py, wc.mood === "lapar" ? (Math.sin(now * 0.012) > 0 ? 4.4 : 2.6) : 3.6, 0, Math.PI * 2);
          ctx.fill();
          // nama
          ctx.font = "600 9px ui-monospace, SFMono-Regular, Menlo, monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(191,232,204,0.85)";
          ctx.fillText(meta.name, px, py - 11);
          ctx.textAlign = "left";
        }
      } else {
        ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(127,154,137,0.9)";
        ctx.fillText("DUNIA BELUM BERDENYUT — PICU DENYUT UNTUK MELAHIRKAN PLANET", w / 2, skyH + (h - skyH) / 2);
        ctx.textAlign = "left";
      }

      // ---- overlay tombol creature (HTML) mengikuti posisi lerp ----
      for (const meta of CREATURES) {
        const el = overlayRefs.current[meta.id];
        const disp = dispRef.current[meta.id];
        if (!el || !disp) continue;
        el.style.transform = `translate(${(disp.x * w).toFixed(1)}px, ${(disp.y * h).toFixed(1)}px) translate(-50%, -50%)`;
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Klik kanvas → hit-test biome (deterministik, tanpa random logika).
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    if (ny < 0.235) {
      onSelectBiome("langit");
      return;
    }
    for (const b of BIOMES) {
      const c = BIOME_CENTER[b.id];
      if (b.id === "langit") continue;
      const dx = (nx - c.x) / (c.r * 1.18);
      const dy = (ny - c.y) / (c.r * 1.18 * 0.72);
      if (dx * dx + dy * dy <= 1) {
        onSelectBiome(b.id);
        return;
      }
    }
    onSelectBiome(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative border border-[#13241a] bg-[#070d0a] overflow-hidden"
      style={{ height: "clamp(400px, 55vw, 560px)" }}
      role="group"
      aria-label="Kanvas peta planet — 8 biome dan 6 creature"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-crosshair"
        onClick={handleCanvasClick}
        aria-label="Peta dunia PLANET — klik biome untuk inspeksi"
      />
      {world
        ? CREATURES.map((meta) => {
            const Icon = CREATURE_ICONS[meta.icon] ?? Activity;
            const wc = world.creatures[meta.id];
            const selected = props.selectedCreature === meta.id;
            return (
              <button
                key={meta.id}
                ref={(el) => {
                  overlayRefs.current[meta.id] = el;
                }}
                onClick={() => onSelectCreature(meta.id)}
                aria-label={`${meta.name} — mood ${wc ? MOOD_LABEL[wc.mood] : "?"} — biome ${wc?.biome ?? "?"}`}
                aria-pressed={selected}
                className="absolute left-0 top-0 z-10 will-change-transform"
              >
                <span className="flex flex-col items-center gap-0.5">
                  <Icon
                    className="w-4 h-4 drop-shadow"
                    style={{ color: meta.color, filter: selected ? `drop-shadow(0 0 6px ${meta.color})` : undefined }}
                  />
                  {selected && (
                    <span className="catalog !text-[8px] border px-1" style={{ color: meta.color, borderColor: meta.color, background: "rgba(7,13,10,0.85)" }}>
                      {meta.name}
                    </span>
                  )}
                </span>
              </button>
            );
          })
        : null}
      <span className="absolute bottom-2 left-3 catalog !text-[9px] text-[#4ade80] pointer-events-none">
        PETA PLANET — 8 BIOME · 6 MAKHLUK · KLIK UNTUK INSPEKSI
      </span>
      <span className="absolute bottom-2 right-3 catalog !text-[9px] text-[#7f9a89] pointer-events-none">
        denyut dunia #{world?.tickCount ?? 0}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspektor biome
// ---------------------------------------------------------------------------

function BiomeInspector({ biome, world, creatures }: { biome: BiomeId; world: WorldState; creatures: CreatureState[] }) {
  const setView = useFlybrain((s) => s.setView);
  const meta = BIOMES.find((b) => b.id === biome);
  if (!meta) return null;
  const Icon = BIOME_ICONS[meta.icon] ?? Sparkles;
  const stB = world.biomes[biome];
  const penghuni = Object.values(world.creatures).filter((c) => c.biome === biome);
  const wire = WIRE_TABLE.find((w) => w.biome === biome);

  return (
    <div className="space-y-3" aria-label={`Inspektor biome ${meta.nama}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="catalog !text-[9px] border px-2 py-0.5 inline-flex items-center gap-1.5" style={{ borderColor: meta.color, color: meta.color }}>
          <Icon className="w-3 h-3" />
          BIOME · {meta.nama.toUpperCase()}
        </span>
        <span className="catalog !text-[8px] border border-[#1b2f24] text-[#9db8a6] px-1.5 py-0.5">#{WIRE_TABLE.findIndex((w) => w.biome === biome) + 1}</span>
      </div>
      <p className="text-[11px] text-[#9db8a6] leading-relaxed">{meta.deskripsi}</p>

      <div className="grid gap-2">
        <Bar label={`STOK ENERGI (${stB.energi.toFixed(1)}/100)`} value={stB.energi} max={100} color={meta.color} />
        <Bar label={`KESUBURAN (${stB.fertility.toFixed(1)}/100)`} value={stB.fertility} max={100} color="#a78bfa" />
        <Bar label={`PRODUKSI/DENYUT (${stB.produksiTerakhir.toFixed(2)})`} value={stB.produksiTerakhir} max={5} color="#4ade80" />
        <Bar label={`KONSUMSI GRAZING (${stB.konsumsiTerakhir.toFixed(2)})`} value={stB.konsumsiTerakhir} max={5} color="#fbbf24" />
      </div>

      <div>
        <div className="catalog !text-[9px] mb-1">SINYAL NYATA TERAKHIR</div>
        <div className="border border-[#13241a] bg-[#0a130e] p-2.5 font-mono text-[10px] text-[#bfe8cc] break-words">{stB.sinyalTerakhir}</div>
      </div>

      <div>
        <div className="catalog !text-[9px] mb-1">FITUR NYATA TER-WIRE (PETA SISTEM)</div>
        <ul className="space-y-1 text-[11px] text-[#bfe8cc]">
          <li>· fitur: {wire?.fitur}</li>
          <li>· sinyal input: <span className="font-mono text-[10px] text-[#9db8a6]">{wire?.sinyal}</span></li>
          <li>· output hidup: {wire?.output}</li>
        </ul>
      </div>

      <div>
        <div className="catalog !text-[9px] mb-1">PENGHUNI ({penghuni.length})</div>
        {penghuni.length === 0 ? (
          <p className="text-[11px] text-[#7f9a89]">Tidak ada creature — biome kosong mengurangi kesuburan (rantai makanan nyata).</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {penghuni.map((c) => {
              const cm = CREATURES.find((m) => m.id === c.id);
              return (
                <span key={c.id} className="catalog !text-[8px] border px-1.5 py-0.5" style={{ color: cm?.color, borderColor: cm?.color }}>
                  {c.id} · {MOOD_LABEL[c.mood]}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {biome !== "langit" && (
        <p className="text-[10px] text-[#7f9a89]">
          {creatures.filter((c) => c.status === "aktif").length} creature aktif siap grazing stok energi biome ini tiap denyut.
        </p>
      )}

      <button
        onClick={() => setView(meta.view as ViewKey)}
        className="w-full border px-3 py-2 text-xs hover:bg-[#0d1a12] transition-colors inline-flex items-center justify-center gap-2"
        style={{ borderColor: meta.color, color: meta.color }}
      >
        BUKA FITUR → {VIEW_LABEL[meta.view as ViewKey]}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspektor creature
// ---------------------------------------------------------------------------

function CreatureInspector({ id, world, creatures }: { id: string; world: WorldState; creatures: CreatureState[] }) {
  const decisionStream = useFlybrain((s) => s.decisionStream);
  const meta = CREATURES.find((m) => m.id === id);
  const live = creatures.find((c) => c.id === id);
  const wc = world.creatures[id as keyof typeof world.creatures];
  if (!meta || !wc) return null;
  const Icon = CREATURE_ICONS[meta.icon] ?? Activity;
  const trace = decisionStream.find((t) => t.creatureId === id) ?? null;

  return (
    <div className="space-y-3" aria-label={`Inspektor creature ${meta.name}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="catalog !text-[9px] border px-2 py-0.5 inline-flex items-center gap-1.5" style={{ borderColor: meta.color, color: meta.color }}>
          <Icon className="w-3 h-3" />
          {meta.name} · {meta.species}
        </span>
        <span className="catalog !text-[8px] border px-1.5 py-0.5" style={{ borderColor: wc.mood === "bekerja" ? "#274434" : wc.mood === "lapar" ? "#7f1d1d" : "#334155", color: wc.mood === "bekerja" ? "#4ade80" : wc.mood === "lapar" ? "#f87171" : "#94a3b8" }}>
          {MOOD_LABEL[wc.mood]}
        </span>
      </div>

      <div className="grid gap-2">
        <Bar label={`ENERGI TUBUH (${live?.energy ?? "?"}/100)`} value={live?.energy ?? 0} max={100} color={meta.color} />
        <Bar label={`KEKAYAAN SIMULASI (${live?.wealth ?? 0} — BUKAN UANG RIIL)`} value={live?.wealth ?? 0} max={Math.max(50, live?.wealth ?? 50)} color="#fbbf24" />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="border border-[#13241a] bg-[#0a130e] p-2">
          <div className="catalog !text-[8px] mb-1">BIOME SAAT INI</div>
          <span className="text-[#bfe8cc]">{BIOMES.find((b) => b.id === wc.biome)?.nama ?? wc.biome}</span>
        </div>
        <div className="border border-[#13241a] bg-[#0a130e] p-2">
          <div className="catalog !text-[8px] mb-1">RUMAH PERAN</div>
          <span className="text-[#bfe8cc]">{BIOMES.find((b) => b.id === wc.homeBiome)?.nama ?? wc.homeBiome}</span>
        </div>
      </div>

      <div>
        <div className="catalog !text-[9px] mb-1">KEPUTUSAN GERAK TERAKHIR [H]</div>
        <div className="border border-[#13241a] bg-[#0a130e] p-2.5 text-[10px] text-[#bfe8cc] break-words">
          {wc.lastReason ?? "—"} · trail {wc.trail.length} titik · gerak {wc.lastMoveAt.slice(11, 19) ?? "—"}
        </div>
      </div>

      <div>
        <div className="catalog !text-[9px] mb-1">JEJAK DENYUT TERAKHIR</div>
        {trace ? (
          <div className="border border-[#13241a] bg-[#0a130e] p-2.5 text-[10px] space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono" style={{ color: trace.mode === "llm" ? "#4ade80" : "#fbbf24" }}>
                {trace.mode === "llm" ? "LLM (menalar)" : "REFLEKS"}
              </span>
              <span className="font-mono text-[#7f9a89]">{trace.at.slice(11, 19)} · {trace.latencyMs} ms</span>
            </div>
            <p className="text-[#bfe8cc] break-words">PUTUSKAN: {trace.phases.putuskan}</p>
            <p className="text-[#9db8a6] break-words">BERTINDAK: {trace.action.type}{trace.action.target ? ` → ${trace.action.target}` : ""}</p>
          </div>
        ) : (
          <div className="border border-dashed border-[#1b2f24] p-2.5 text-[10px] text-[#7f9a89]">
            {meta.name} belum berdenyut di sesi ini — klik PICU DENYUT.
          </div>
        )}
      </div>

      <div>
        <div className="catalog !text-[9px] mb-1">GENOM &amp; SKILL</div>
        <div className="flex flex-wrap gap-1.5">
          {(live?.genome ?? meta.traits).map((g) => (
            <span key={g} className="catalog !text-[8px] border border-[#274434] text-[#4ade80] px-1.5 py-0.5">{g}</span>
          ))}
          {(live?.skills ?? []).map((s) => (
            <span key={s} className="catalog !text-[8px] border border-[#7a6a1e] text-[#fbbf24] px-1.5 py-0.5">{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bar mini (gaya konsisten BiosferView)
// ---------------------------------------------------------------------------

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 0.0001)) * 100));
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="catalog !text-[9px]">{label}</span>
        <span className="font-mono text-[10px] text-[#bfe8cc]">{value.toFixed(value < 10 ? 1 : 0)}</span>
      </div>
      <div className="mt-1 h-1.5 bg-[#0d1712] border border-[#13241a]">
        <div className="h-full" style={{ width: `${pct}%`, background: color, opacity: 0.85 }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View utama
// ---------------------------------------------------------------------------

export function PlanetView() {
  const world = useFlybrain((s) => s.world);
  const lastWorldTickAt = useFlybrain((s) => s.lastWorldTickAt);
  const creatures = useFlybrain((s) => s.creatures);
  const lastQuant = useFlybrain((s) => s.lastQuant);
  const reflectVerdict = useFlybrain((s) => s.reflectVerdict);
  const eventLog = useFlybrain((s) => s.eventLog);
  const biosferBusy = useFlybrain((s) => s.biosferBusy);
  const tickCreature = useFlybrain((s) => s.tickCreature);

  const [selectedBiome, setSelectedBiome] = useState<BiomeId | null>(null);
  const [selectedCreature, setSelectedCreature] = useState<string | null>(null);
  const [highlightBiome, setHighlightBiome] = useState<BiomeId | null>(null);

  const breakerOpen = useMemo(
    () => creatures.filter((c) => immune.breaker.isOpen(c.id)).length,
    [creatures],
  );

  const quantVolatility = useMemo(() => {
    if (!lastQuant) return 0;
    const vols = Object.values(lastQuant.risks).map((r) => r.volatility);
    return vols.length ? Math.min(1, Math.max(...vols) * 4) : 0;
  }, [lastQuant]);

  const vetoRecent = useMemo(
    () => eventLog.slice(0, 12).some((e) => e.type === "reflect" && /VETO/i.test(e.message)),
    [eventLog],
  );
  const decideRecent = useMemo(() => {
    const first = eventLog[0];
    return Boolean(first && first.type === "decide" && Date.now() - new Date(first.at).getTime() < 6000);
  }, [eventLog]);

  const snapshot = useMemo(() => (world ? worldSnapshot(world) : null), [world]);
  const climate = world?.climate ?? null;

  return (
    <div className="px-4 sm:px-8 py-8">
      {/* HEADER */}
      <header className="mb-6">
        <p className="catalog catalog-phos">08 — PLANET · PETA DUNIA HIDUP</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-2">
          Satu dunia, delapan alam — semua fitur adalah bagian ekologi yang sama
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#9db8a6]">
          <span>
            DENYUT DUNIA: <span className="font-mono text-[#4ade80]">#{world?.tickCount ?? 0}</span>
            {lastWorldTickAt ? <span className="font-mono text-[#7f9a89]"> · {lastWorldTickAt.slice(11, 19)}</span> : null}
          </span>
          {climate && (
            <span>
              HARI {climate.hari} · <span className="font-mono">{jamLabel(climate.jamDunia)}</span> · {climate.fase.toUpperCase()} · {climate.cuaca.toUpperCase()} · MUSIM {climate.musim.toUpperCase()}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            WORLD TICK: <span className="w-2 h-2 rounded-full bg-[#4ade80] breathe inline-block" aria-hidden />
            <span className="font-mono">ikut denyut biosfer (tanpa LLM)</span>
          </span>
        </div>
      </header>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Kiri: kanvas + denyut + jaring makanan */}
        <div className="lg:col-span-3 space-y-4">
          <section className="specimen-frame p-4 sm:p-5" aria-label="Kanvas planet">
            <div className="flex items-center justify-between mb-3">
              <div className="catalog catalog-phos">KANVAS PLANET — LANGIT KONNEKTOM + 7 DARATAN</div>
              <button
                onClick={() => void tickCreature()}
                disabled={biosferBusy}
                className="border border-[#274434] text-[#4ade80] px-3 py-1.5 text-[11px] hover:bg-[#0d1a12] transition-colors disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                {biosferBusy ? "BERDENYUT…" : "PICU DENYUT DUNIA"}
              </button>
            </div>
            <PlanetCanvas
              world={world}
              creatures={creatures}
              selectedBiome={selectedBiome}
              selectedCreature={selectedCreature}
              highlightBiome={highlightBiome}
              quantVolatility={quantVolatility}
              breakerOpen={breakerOpen}
              vetoRecent={vetoRecent}
              decideRecent={decideRecent}
              reflectVerdict={reflectVerdict}
              onSelectBiome={(b) => {
                setSelectedBiome(b);
                setSelectedCreature(null);
                setHighlightBiome(b);
              }}
              onSelectCreature={(id) => {
                setSelectedCreature(id);
                setSelectedBiome(null);
              }}
            />
            <p className="mt-3 text-[10px] text-[#7f9a89] leading-relaxed">
              Dunia = <span className="text-[#bfe8cc]">metafora visual dari data nyata</span> — tidak ada keputusan baru
              yang diambil dunia; ia menyalurkan energi aksi creature yang sudah ada. Label [T] = wire table fitur nyata,
              [D] = mekanisme iklim, [H] = hipotesis perilaku gerak (12_ECOSYSTEM §7).
            </p>
          </section>

          {/* JARING MAKANAN */}
          <section className="specimen-frame p-4 sm:p-5" aria-label="Jaring makanan">
            <div className="flex items-center justify-between mb-3">
              <div className="catalog catalog-phos">JARING MAKANAN — ALIRAN ENERGI BIOME → CREATURE → NUTRISI</div>
              <Moon className="w-3.5 h-3.5 text-[#94a3b8]" />
            </div>
            {snapshot ? (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {snapshot.biomes.map((b) => {
                  const meta = BIOMES.find((x) => x.id === b.id);
                  const Icon = BIOME_ICONS[meta?.icon ?? ""] ?? Sparkles;
                  return (
                    <div key={b.id} className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 items-center border border-[#13241a] bg-[#0a130e] px-3 py-2">
                      <Icon className="w-3.5 h-3.5" style={{ color: meta?.color }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="catalog !text-[9px]" style={{ color: meta?.color }}>{b.nama.toUpperCase()}</span>
                          <span className="font-mono text-[9px] text-[#7f9a89]">
                            produksi {b.produksi.toFixed(2)} · konsumsi {b.konsumsi.toFixed(2)} · penghuni {b.penghuni.length}
                          </span>
                        </div>
                        <div className="mt-1 grid grid-cols-3 gap-1.5">
                          <MiniFlow label="energi" value={b.energi} color="#4ade80" />
                          <MiniFlow label="fertilitas" value={b.fertility} color="#a78bfa" />
                          <MiniFlow
                            label="nutrisi→"
                            value={Math.min(100, b.fertility * 0.6 + b.produksi * 6)}
                            color="#fbbf24"
                          />
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-[#bfe8cc]">{b.energi.toFixed(0)}</span>
                    </div>
                  );
                })}
                <p className="text-[10px] text-[#7f9a89] leading-relaxed">
                  Produksi ∝ aktivitas nyata (vault, gerbang, quant, skill, kwitansi, reflect, breaker) × musim × cuaca.
                  Creature menggembalakan stok biome (bukan angin kosong); aksinya menyetor nutrisi balik — kesuburan naik,
                  biome kosong membuat creature migrasi.
                </p>
              </div>
            ) : (
              <div className="border border-dashed border-[#1b2f24] p-3 text-[11px] text-[#7f9a89]">
                Dunia belum berdenyut — klik PICU DENYUT DUNIA (atau denyut otomatis ±45 dtk di mandat L3+).
              </div>
            )}
          </section>
        </div>

        {/* Kanan: inspektor + iklim + peta sistem */}
        <div className="lg:col-span-2 space-y-4">
          <section className="specimen-frame p-4 sm:p-5" aria-label="Inspektor">
            <div className="catalog catalog-phos mb-3">
              {selectedCreature ? "INSPEKTOR CREATURE" : selectedBiome ? "INSPEKTOR BIOME" : "INSPEKTOR — PILIH DI KANVAS"}
            </div>
            {world && selectedCreature ? (
              <CreatureInspector id={selectedCreature} world={world} creatures={creatures} />
            ) : world && selectedBiome ? (
              <BiomeInspector biome={selectedBiome} world={world} creatures={creatures} />
            ) : (
              <div className="border border-dashed border-[#1b2f24] p-4 text-xs text-[#7f9a89] leading-relaxed" role="note">
                <p className="text-[#bfe8cc] mb-1.5">Inspektor kosong — pilih di kanvas.</p>
                Klik salah satu biome (blob organik) untuk melihat kesuburan, stok energi, sinyal nyata yang menyalakannya,
                dan tombol buka fitur terkait. Klik creature untuk genom, energi, mood, dan keputusan geraknya.
              </div>
            )}
          </section>

          {/* IKLIM */}
          <section className="specimen-frame p-4 sm:p-5" aria-label="Panel iklim">
            <div className="catalog catalog-phos mb-3">IKLIM — SEMUA DARI DATA NYATA</div>
            {climate && snapshot ? (
              <div className="space-y-2.5 text-[11px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="catalog !text-[9px] border border-[#274434] text-[#4ade80] px-1.5 py-0.5">HARI {snapshot.climate.hari}/7</span>
                  <span className="font-mono text-[#bfe8cc]">{jamLabel(snapshot.climate.jam)} dunia</span>
                  <span className="catalog !text-[9px] border border-[#1b2f24] text-[#9db8a6] px-1.5 py-0.5">{climate.fase.toUpperCase()}</span>
                  {climate.angin && <span className="catalog !text-[9px] border border-[#7a6a1e] text-[#fbbf24] px-1.5 py-0.5">ANGIN</span>}
                </div>
                {/* pita 12 denyut = 1 hari */}
                <div className="flex gap-0.5" aria-label="Siklus 12 denyut = 1 hari dunia">
                  {Array.from({ length: 12 }, (_, i) => {
                    const jam = i * 2;
                    const shade = jam >= 5 && jam < 7 ? "#7c2d12" : jam >= 7 && jam < 17 ? "#4ade80" : jam >= 17 && jam < 19 ? "#fbbf24" : "#1e3a5f";
                    const active = i === Math.max(0, Math.round(climate.beat)) % 12;
                    return (
                      <span
                        key={i}
                        className="h-2.5 flex-1 border border-[#070d0a]"
                        style={{ background: shade, opacity: active ? 1 : 0.35 }}
                        title={`denyut ${i + 1} — jam ${jamLabel(jam)}`}
                      />
                    );
                  })}
                </div>
                <div className="border border-[#13241a] bg-[#0a130e] p-2.5 space-y-1.5">
                  <p className="text-[#bfe8cc]">
                    CUACA: <span className="font-mono uppercase">{climate.cuaca}</span>
                    <span className="font-mono text-[#7f9a89]"> · rasio gagal {(climate.errorRatio * 100).toFixed(0)}% / 20 denyut</span>
                  </p>
                  <p className="text-[10px] text-[#9db8a6] leading-relaxed">{climate.alasanCuaca}</p>
                  <p className="text-[#bfe8cc] pt-1 border-t border-[#13241a]">
                    MUSIM: <span className="font-mono uppercase">{climate.musim}</span>
                    <span className="font-mono text-[#7f9a89]"> · verdict {climate.verdictSumber ?? "belum ada"}</span>
                  </p>
                  <p className="text-[10px] text-[#9db8a6] leading-relaxed">{climate.alasanMusim}</p>
                </div>
                {reflectVerdict && (
                  <p className="text-[10px] text-[#7f9a89]">
                    Sumber musim = verdict self-reflect terakhir ({reflectVerdict.issues.length} isu · {reflectVerdict.actions_taken.length} remediasi dieksekusi).
                  </p>
                )}
              </div>
            ) : (
              <div className="border border-dashed border-[#1b2f24] p-3 text-[11px] text-[#7f9a89]">
                Iklim terhitung saat denyut pertama — cuaca dari rasio kegagalan 20 denyut, musim dari verdict self-reflect.
              </div>
            )}
          </section>

          {/* PETA SISTEM — wire table §1 */}
          <section className="specimen-frame p-4 sm:p-5" aria-label="Peta sistem — wire table">
            <div className="catalog catalog-phos mb-1">PETA SISTEM — WIRE TABLE 8/8</div>
            <p className="text-[10px] text-[#7f9a89] mb-3 leading-relaxed">
              Tidak ada fitur tanpa biome. Klik baris → highlight di kanvas + inspektor biome.
            </p>
            <ul className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {WIRE_TABLE.map((row) => {
                const meta = BIOMES.find((b) => b.id === row.biome);
                const Icon = BIOME_ICONS[meta?.icon ?? ""] ?? Sparkles;
                const active = highlightBiome === row.biome;
                return (
                  <li key={row.biome}>
                    <button
                      onClick={() => {
                        setHighlightBiome(row.biome);
                        setSelectedBiome(row.biome);
                        setSelectedCreature(null);
                      }}
                      aria-pressed={active}
                      className={`w-full text-left border px-2.5 py-2 transition-colors ${
                        active ? "bg-[#0d1a12]" : "hover:bg-[#0b140f]"
                      }`}
                      style={{ borderColor: active ? meta?.color : "#13241a" }}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[9px] text-[#7f9a89]">{String(row.no).padStart(2, "0")}</span>
                        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: meta?.color }} />
                        <span className="catalog !text-[9px]" style={{ color: meta?.color }}>{row.nama.toUpperCase()}</span>
                        <span className="ml-auto catalog !text-[8px] text-[#7f9a89]">{VIEW_LABEL[row.view as ViewKey]}</span>
                      </span>
                      <span className="block mt-1 text-[10px] text-[#9db8a6] leading-snug">{row.fitur}</span>
                      <span className="block text-[9px] font-mono text-[#7f9a89] leading-snug truncate">sinyal: {row.sinyal}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Bar aliran mini untuk jaring makanan. */
function MiniFlow({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(2, Math.min(100, value));
  return (
    <div>
      <div className="h-1 bg-[#0d1712] border border-[#13241a]">
        <div className="h-full" style={{ width: `${pct}%`, background: color, opacity: 0.8 }} />
      </div>
      <span className="catalog !text-[7px] text-[#7f9a89]">{label}</span>
    </div>
  );
}
