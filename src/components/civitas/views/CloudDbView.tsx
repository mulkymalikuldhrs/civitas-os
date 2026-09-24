"use client";
// CIVITAS OS — CloudDbView (v1.5 "CITADEL")
// PETA DATABASE PENUH: semua tabel Supabase + kolom + tipe + PK + jumlah baris,
// cermin kernel SQLite, bucket storage. Realtime: poll 15 dtk + tombol segarkan paksa.

import { useCallback, useEffect, useState } from "react";
import { MCBadge, MCButton, MCInput, MCPanel, MCSectionTitle } from "../mcui";

interface DbMapColumn { name: string; type: string; required: boolean; pk: boolean }
interface DbMapTable { name: string; columns: DbMapColumn[]; rows: number | null; error?: string }
interface KernelTable { model: string; table: string; rows: number }
interface DbMapPayload {
  at: string;
  ok: boolean;
  cached: boolean;
  cloud: { url: string; tables: DbMapTable[]; buckets: { name: string; public: boolean }[]; error?: string };
  kernel: { tables: KernelTable[]; totalRows: number; error?: string };
}
interface HostPayload { hostnames: string[]; java: string; bedrock: string; aternos: string; platform: string }

export default function CloudDbView() {
  const [map, setMap] = useState<DbMapPayload | null>(null);
  const [host, setHost] = useState<HostPayload | null>(null);
  const [open, setOpen] = useState<string>("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (fresh = false) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/civos/dbmap${fresh ? "?fresh=1" : ""}`, { cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean; map?: DbMapPayload; host?: HostPayload };
      setMap(j.map ?? null);
      setHost(j.host ?? null);
    } catch { /* poll berikutnya */ }
    setBusy(false);
  }, []);

  useEffect(() => {
    const t0 = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), 15_000);
    return () => { clearTimeout(t0); clearInterval(t); };
  }, [load]);

  const cloudTables = (map?.cloud.tables ?? []).filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));
  const cloudTotal = (map?.cloud.tables ?? []).reduce((s, t) => s + (t.rows ?? 0), 0);

  return (
    <div className="grid gap-4">
      <MCPanel dark>
        <MCSectionTitle>PETA DATABASE SUPABASE — SEMUA TABEL · KOLOM · BARIS (NYATA)</MCSectionTitle>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {map?.ok ? <MCBadge tone="green">TERHUBUNG</MCBadge> : <MCBadge tone="red">{map?.cloud.error ?? "TERPUTUS"}</MCBadge>}
          <MCBadge tone="stone">{map?.cloud.tables.length ?? 0} tabel awan</MCBadge>
          <MCBadge tone="xp">{cloudTotal.toLocaleString("id-ID")} baris awan</MCBadge>
          <MCBadge tone="diamond">{map?.kernel.tables.length ?? 0} tabel kernel</MCBadge>
          <MCBadge tone="gold">{(map?.kernel.totalRows ?? 0).toLocaleString("id-ID")} baris kernel</MCBadge>
          {map?.cached ? <MCBadge tone="stone">cache 60dtk</MCBadge> : <MCBadge tone="stone">data segar</MCBadge>}
          <span className="flex-1" />
          <MCInput
            placeholder="cari tabel…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="!w-40 !py-1 !text-sm"
            aria-label="cari tabel"
          />
          <MCButton tone="gold" disabled={busy} onClick={() => void load(true)}>SEGARKAN PAKSA</MCButton>
        </div>
        {map ? <p className="mc-font text-[8px] text-white/50">pemetaan: {new Date(map.at).toLocaleString()} · sumber: PostgREST OpenAPI + count=exact + Prisma</p> : null}
      </MCPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* CLOUD */}
        <MCPanel>
          <MCSectionTitle>SUPABASE — {map?.cloud.url.replace(/^https?:\/\//, "").slice(0, 40) || "…"} </MCSectionTitle>
          <div className="max-h-[520px] overflow-y-auto mc-scroll flex flex-col gap-2 pr-1">
            {cloudTables.map((t) => (
              <div key={t.name} className="border-2 border-black/40 bg-[#3a3a3f]">
                <button
                  className="w-full text-left p-2 flex items-center justify-between gap-2 hover:bg-[#45454b]"
                  onClick={() => setOpen(open === t.name ? "" : t.name)}
                  aria-expanded={open === t.name}
                >
                  <span className="mc-font text-[9px] text-white">{t.name}</span>
                  <span className="flex items-center gap-1">
                    <MCBadge tone={t.error ? "red" : "green"}>{t.error ? "gagal" : `${t.rows ?? "?"} baris`}</MCBadge>
                    <MCBadge tone="stone">{t.columns.length} kolom</MCBadge>
                  </span>
                </button>
                {open === t.name ? (
                  <div className="border-t-2 border-black/40 p-2 max-h-56 overflow-y-auto mc-scroll">
                    {t.columns.map((c) => (
                      <div key={c.name} className="flex items-center justify-between py-0.5 border-b border-white/5">
                        <span className="mc-body text-[13px] text-white/90">{c.pk ? "🔑 " : ""}{c.name}{c.required ? "" : " (boleh kosong)"}</span>
                        <span className="mc-font text-[7px] text-[color:var(--mc-xp)]">{c.type}</span>
                      </div>
                    ))}
                    {t.error ? <p className="mc-body text-[12px] text-red-300 mt-1">{t.error}</p> : null}
                  </div>
                ) : null}
              </div>
            ))}
            {cloudTables.length === 0 ? <p className="mc-body text-[13px] text-white/50">tidak ada tabel cocok — atau kredensial belum diisi</p> : null}
          </div>
          {map?.cloud.buckets.length ? (
            <div className="mt-3">
              <p className="mc-font text-[9px] text-white/70 mb-1">STORAGE BUCKETS</p>
              <div className="flex flex-wrap gap-1">
                {map.cloud.buckets.map((b) => (
                  <MCBadge key={b.name} tone="diamond">{b.name}{b.public ? " · publik" : ""}</MCBadge>
                ))}
              </div>
            </div>
          ) : null}
        </MCPanel>

        {/* KERNEL */}
        <MCPanel>
          <MCSectionTitle>KERNEL SQLITE LOKAL — CERMIN OTORITATIF</MCSectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto mc-scroll pr-1">
            {(map?.kernel.tables ?? []).map((t) => (
              <div key={t.table} className="border-2 border-black/40 bg-[#3a3a3f] p-2">
                <p className="mc-font text-[8px] text-white/80 truncate">{t.table}</p>
                <p className="mc-font text-[11px] text-[color:var(--mc-xp)]">{t.rows < 0 ? "err" : t.rows.toLocaleString("id-ID")}</p>
              </div>
            ))}
          </div>
          {map?.kernel.error ? <p className="mc-body text-[12px] text-red-300 mt-2">catatan: {map.kernel.error}</p> : null}
          <p className="mc-body text-[12px] text-white/60 mt-2">
            Kernel SQLite adalah sumber kebenaran; seluruh isinya dicerminkan ke Supabase tiap siklus sinkron (pushFullMirror, idempoten by PK).
          </p>
          {host ? (
            <p className="mc-font text-[8px] text-white/50 mt-3">
              host: {host.hostnames.join(", ")} · java {host.java} · bedrock {host.bedrock} · aternos {host.aternos}
            </p>
          ) : null}
        </MCPanel>
      </div>
    </div>
  );
}
