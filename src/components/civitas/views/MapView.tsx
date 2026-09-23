"use client";
// CIVITAS OS — MapView: PETA peradaban + REGISTRI IDENTITAS (mandat #10).
// Kanvas piksel deterministik: medan dari hash kota, bangunan dari entitas dunia,
// warga dari koordinat sensus/direktif. Klik marker → kartu identitas.

import { useEffect, useRef, useState } from "react";
import { MCPanel, MCSectionTitle, MCBadge, MCSlot } from "../mcui";
import { useCiv, type EntityRec, type VillagerRec } from "../McShell";

interface Marker { x: number; y: number; label: string; kind: "city" | "building" | "villager" | "bot" }

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export default function MapView() {
  const { s } = useCiv();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sel, setSel] = useState<Marker | null>(null);

  const entities = (s?.entities ?? []) as EntityRec[];
  const villagers = (s?.village?.villagers ?? []) as VillagerRec[];
  const cities = (s?.orgs ?? []).filter((o) => o.kind === "CITY");

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const W = cv.width, H = cv.height;
    const tile = 16;

    // medan: grid deterministik (rumput/tanah/batu/air) dari hash koordinat
    for (let gy = 0; gy < H / tile; gy++) {
      for (let gx = 0; gx < W / tile; gx++) {
        const h = hash32(`${gx}:${gy}`);
        const r = h % 100;
        let color = "#5f8f43"; // rumput
        if (r > 82) color = "#8a5a3b"; // tanah
        else if (r > 74) color = "#6f6f74"; // batu
        else if (r < 7) color = "#3a5f8f"; // air
        const shade = ((h >> 4) % 12) - 6;
        ctx.fillStyle = adjust(color, shade);
        ctx.fillRect(gx * tile, gy * tile, tile, tile);
        // noise piksel
        if ((h & 3) === 0) { ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.fillRect(gx * tile + 4, gy * tile + 6, 6, 4); }
      }
    }

    // grid peradaban: kota + bangunan + warga → posisi peta
    const markers: Marker[] = [];
    cities.forEach((c, i) => {
      const h = hash32(c.code);
      markers.push({ x: 80 + (h % (W - 160)), y: 60 + ((h >> 8) % (H - 140)), label: c.name, kind: "city" });
      if (i === 0 && cities.length > 0) { /* nanti diisi bangunan di bawah */ }
    });
    entities.forEach((e) => {
      const h = hash32(e.id);
      const base = markers.find((m) => m.kind === "city") ?? { x: W / 2, y: H / 2 };
      markers.push({ x: Math.min(W - 40, Math.max(40, (base.x + (h % 200)) - 100)), y: Math.min(H - 40, Math.max(40, (base.y + ((h >> 6) % 160)) - 80)), label: e.mcName, kind: "building" });
    });
    villagers.forEach((v) => {
      const h = hash32(v.code + (v.coords ?? ""));
      markers.push({ x: 60 + (h % (W - 120)), y: 50 + ((h >> 5) % (H - 110)), label: `${v.name} (${v.division})`, kind: "villager" });
    });
    if (s?.mcStatus?.online) markers.push({ x: W / 2, y: H - 60, label: "CIVITAS_AGENT (bot)", kind: "bot" });

    // gambar marker
    for (const m of markers) {
      if (m.kind === "city") drawFlag(ctx, m.x, m.y, "#ffaa00");
      else if (m.kind === "building") drawHouse(ctx, m.x, m.y);
      else if (m.kind === "bot") drawFlag(ctx, m.x, m.y, "#4aedd9");
      else drawDot(ctx, m.x, m.y, "#7efc20");
    }
    (cv as HTMLCanvasElement & { _markers?: Marker[] })._markers = markers;
  }, [entities, villagers, cities, s?.mcStatus?.online]);

  const onPick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * cv.width;
    const y = ((ev.clientY - rect.top) / rect.height) * cv.height;
    const markers = ((cv as HTMLCanvasElement & { _markers?: Marker[] })._markers ?? []) as Marker[];
    let best: Marker | null = null; let bd = 1e9;
    for (const m of markers) {
      const d = (m.x - x) ** 2 + (m.y - y) ** 2;
      if (d < bd) { bd = d; best = m; }
    }
    if (best && bd < 2200) setSel(best);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <MCPanel dark className="lg:col-span-2">
        <MCSectionTitle>PETA DUNIA PERADABAN</MCSectionTitle>
        <canvas ref={canvasRef} width={760} height={420} className="mc-map-canvas w-full" onClick={onPick} />
        <div className="mt-3 flex flex-wrap gap-2">
          <MCBadge tone="gold">⚑ kota</MCBadge>
          <MCBadge tone="stone">🏠 bangunan</MCBadge>
          <MCBadge tone="xp">● warga</MCBadge>
          <MCBadge tone="diamond">⚑ bot</MCBadge>
        </div>
      </MCPanel>

      <MCPanel>
        <MCSectionTitle>KARTU IDENTITAS</MCSectionTitle>
        {sel ? (
          <MCSlot className="mb-3">
            <p className="mc-font text-[10px] mb-1">{sel.label.toUpperCase()}</p>
            <p className="mc-body text-[14px] text-black/80">Jenis: {sel.kind} · posisi peta {Math.round(sel.x)},{Math.round(sel.y)}</p>
          </MCSlot>
        ) : (
          <p className="mc-body text-black/70 mb-3">Klik marker di peta untuk melihat identitasnya.</p>
        )}
        <div className="mc-inset p-3 max-h-80 overflow-y-auto mc-scroll">
          <p className="mc-font text-[9px] mb-2">REGISTRI WARGA ({villagers.length})</p>
          {villagers.map((v) => (
            <div key={v.code} className="flex items-center justify-between border-b border-black/20 py-1.5">
              <div>
                <p className="mc-body text-[15px] text-black">{v.name} <span className="opacity-60">({v.code})</span></p>
                <p className="mc-body text-[12px] text-black/60">{v.division} · {v.profession} · {v.embodiment}</p>
              </div>
              <MCBadge tone={v.source === "CENSUS" ? "green" : "gold"}>{v.source === "CENSUS" ? "NYATA" : "SIM"}</MCBadge>
            </div>
          ))}
        </div>
      </MCPanel>
    </div>
  );
}

/* ---------- gambar piksel ---------- */

function adjust(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}
function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, c: string) {
  ctx.fillStyle = "#000"; ctx.fillRect(x - 4, y - 4, 8, 8);
  ctx.fillStyle = c; ctx.fillRect(x - 3, y - 3, 6, 6);
}
function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, c: string) {
  ctx.fillStyle = "#3f3f3f"; ctx.fillRect(x - 1, y - 18, 2, 22);
  ctx.fillStyle = c; ctx.fillRect(x + 1, y - 18, 14, 9);
  ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.strokeRect(x + 1.5, y - 17.5, 13, 8);
}
function drawHouse(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#8a5a3b"; ctx.fillRect(x - 7, y - 4, 14, 9);
  ctx.fillStyle = "#b8945f"; ctx.fillRect(x - 7, y - 4, 14, 3);
  ctx.fillStyle = "#a03b3b";
  ctx.beginPath(); ctx.moveTo(x - 9, y - 4); ctx.lineTo(x, y - 12); ctx.lineTo(x + 9, y - 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#3a3a3a"; ctx.fillRect(x - 2, y + 1, 4, 4);
}
