"use client";
// CIVITAS OS — GraphView: peta arsitektur (file + wiring) & indeks (mandat #12).

import { useEffect, useMemo, useState } from "react";
import { MCPanel, MCSectionTitle, MCBadge } from "../mcui";

interface GraphNode { id: string; size: number; group: string; loc: number }
interface GraphEdge { from: string; to: string }
interface Graph { generatedAt: string; counts: { files: number; edges: number; kernelEdges: number }; groups: Record<string, number>; nodes: GraphNode[]; edges: GraphEdge[] }

const GROUP_COLOR: Record<string, string> = {
  kernel: "#ffaa00",
  api: "#4aedd9",
  "ui-civitas": "#7efc20",
  ui: "#17dd62",
  app: "#ff5555",
  lib: "#b8945f",
  scripts: "#8b8b8b",
  docs: "#6f6f74",
  db: "#8a5a3b",
  "mc-server": "#7cbd56",
  misc: "#555",
};

export default function GraphView() {
  const [g, setG] = useState<Graph | null>(null);
  const [q, setQ] = useState("");
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/civos/graph")
      .then((r) => r.json())
      .then((j: { ok: boolean; graph?: Graph }) => { if (j.ok && j.graph) setG(j.graph); })
      .catch(() => { /* graf belum dibuat */ });
  }, []);

  const filtered = useMemo(() => {
    if (!g) return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] };
    if (!q.trim()) return { nodes: g.nodes, edges: g.edges };
    const ql = q.toLowerCase();
    const nodes = g.nodes.filter((n) => n.id.toLowerCase().includes(ql));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = g.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
    return { nodes, edges };
  }, [g, q]);

  // Layout radial per grup (deterministik)
  const pos = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    const groups = Array.from(new Set(filtered.nodes.map((n) => n.group)));
    filtered.nodes.forEach((n) => {
      const gi = groups.indexOf(n.group);
      const idx = filtered.nodes.filter((m) => m.group === n.group).indexOf(n);
      const count = filtered.nodes.filter((m) => m.group === n.group).length;
      const ring = 150 + gi * 62;
      const angle = (2 * Math.PI * idx) / Math.max(count, 1) + gi * 0.7;
      map.set(n.id, { x: 460 + ring * Math.cos(angle), y: 320 + ring * 0.66 * Math.sin(angle) });
    });
    return map;
  }, [filtered]);

  return (
    <div className="grid gap-4">
      <MCPanel dark>
        <MCSectionTitle>PETA ARSITEKTUR — SEMUA FILE & SAMBUNGAN</MCSectionTitle>
        {g ? (
          <div className="flex flex-wrap gap-2 mb-3">
            <MCBadge tone="gold">{g.counts.files} FILE</MCBadge>
            <MCBadge tone="diamond">{g.counts.edges} SAMBUNGAN</MCBadge>
            <MCBadge tone="green">{g.counts.kernelEdges} WIRING KERNEL</MCBadge>
            {Object.entries(g.groups).map(([k, v]) => <MCBadge key={k}>{k}: {v}</MCBadge>)}
            <span className="flex-1" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="cari file…" className="mc-body bg-[#191919] text-[color:var(--mc-xp)] border-[3px] border-[color:var(--mc-panel-dark)] px-3 py-1.5" />
          </div>
        ) : (
          <p className="mc-body text-white/60">Graf belum tersedia — jalankan <code>node scripts/filegraph.mjs</code>.</p>
        )}
        {g ? (
          <div className="overflow-x-auto mc-scroll">
            <svg width="920" height="640" className="min-w-[920px]">
              {filtered.edges.map((e, i) => {
                const a = pos.get(e.from); const b = pos.get(e.to);
                if (!a || !b) return null;
                const dim = hover && hover !== e.from && hover !== e.to;
                return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={dim ? "#223" : "#3f5f8f"} strokeWidth={dim ? 0.4 : 0.8} opacity={dim ? 0.25 : 0.7} />;
              })}
              {filtered.nodes.map((n) => {
                const p = pos.get(n.id);
                if (!p) return null;
                const c = GROUP_COLOR[n.group] ?? "#888";
                const size = Math.max(2.4, Math.min(7, n.loc / 28));
                return (
                  <g key={n.id} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}>
                    <rect x={p.x - size} y={p.y - size} width={size * 2} height={size * 2} fill={c} stroke={hover === n.id ? "#fff" : "#111"} strokeWidth={hover === n.id ? 2 : 1} />
                    {hover === n.id ? <text x={p.x + 10} y={p.y + 3} fill="#fff" fontSize="11" fontFamily="monospace">{n.id}</text> : null}
                  </g>
                );
              })}
            </svg>
          </div>
        ) : null}
        <p className="mc-body mt-2 text-[13px] text-white/50">{hover ?? "arahkan kursor ke titik untuk nama file — warna = lapisan (kernel emas, api cyan, ui hijau, server MC merah muda)"}</p>
      </MCPanel>

      <MCPanel>
        <MCSectionTitle>INDEKS FILE ({filtered.nodes.length})</MCSectionTitle>
        <div className="mc-inset-dark p-3 max-h-80 overflow-y-auto mc-scroll mc-body text-[14px]">
          {filtered.nodes.map((n) => (
            <p key={n.id} className="border-b border-white/10 py-1">
              <span style={{ color: GROUP_COLOR[n.group] ?? "#888" }}>■</span> {n.id} <span className="text-white/40">· {n.group} · {n.loc} LOC</span>
            </p>
          ))}
        </div>
      </MCPanel>
    </div>
  );
}
