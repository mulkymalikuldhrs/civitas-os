"use client";
// CIVITAS OS — ConfigView: SEMUA konfigurasi editable via UI (mandat #6) + uji nyata.

import { useState } from "react";
import { MCBadge, MCButton, MCInput, MCLog, MCPanel, MCSectionTitle, MCSelect, MCSlot, MCTabs } from "../mcui";
import { useCiv } from "../McShell";

interface FieldRec { key: string; label: string; kind: string; group: string; note?: string; value: string | number | boolean; set: boolean; masked: boolean }

const GROUPS = [
  { key: "minecraft", label: "MINECRAFT" },
  { key: "chat", label: "CHAT" },
  { key: "llm", label: "OTAK" },
  { key: "cloud", label: "SUPABASE" },
  { key: "settlement", label: "SETTLEMENT" },
  { key: "quant", label: "KUANT" },
  { key: "bot", label: "MCP" },
];

export default function ConfigView() {
  const { s, act, refresh } = useCiv();
  const fields = ((s?.config as { fields?: FieldRec[] } | undefined)?.fields ?? []);
  const [group, setGroup] = useState("minecraft");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [testOut, setTestOut] = useState<{ name: string; ok: boolean; detail: string }[]>([]);
  const [mcpName, setMcpName] = useState("");
  const [mcpTransport, setMcpTransport] = useState("HTTP");
  const [mcpEndpoint, setMcpEndpoint] = useState("");

  const shown = fields.filter((f) => f.group === group);

  const save = async (key: string, kind: string, current: string | number | boolean) => {
    const val = draft[key] ?? String(current);
    if (kind === "SECRET" && val.startsWith("••")) return; // tak berubah
    const r = await act("config_put", { key, value: val }, "menyimpan…");
    if (r.ok) setDraft((d) => { const n = { ...d }; delete n[key]; return n; });
    void refresh();
  };

  const runTest = async (which: "minecraft" | "supabase") => {
    setTestOut([{ name: which, ok: true, detail: "menguji…" }]);
    const r = await act("config_test", { key: which }, `menguji ${which}…`);
    if (which === "minecraft" && r.status) {
      const st = r.status as Record<string, unknown>;
      setTestOut([{ name: "minecraft", ok: r.ok === true, detail: st.online ? `ONLINE ${st.latencyMs}ms · ${st.version} · ${st.players} pemain` : `OFFLINE: ${st.error}` }]);
    } else {
      const checks = (r.checks ?? []) as { name: string; ok: boolean; detail: string }[];
      setTestOut(checks.length > 0 ? checks : [{ name: "supabase", ok: false, detail: String(r.error ?? "gagal") }]);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <MCPanel dark className="lg:col-span-2">
        <MCSectionTitle>KONFIGURASI RUNTIME — EFektif TANPA RESTART</MCSectionTitle>
        <MCTabs tabs={GROUPS} active={group} onSelect={setGroup} className="mb-4" />
        {shown.map((f) => (
          <div key={f.key} className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="mc-font text-[9px] text-[color:var(--mc-gold)]">{f.label.toUpperCase()}</span>
              <code className="mc-body text-[12px] text-white/40">{f.key}</code>
              <MCBadge tone={f.set ? "green" : "stone"}>{f.set ? "DISET" : "DEFAULT"}</MCBadge>
              {f.masked ? <MCBadge tone="gold">RAHASIA</MCBadge> : null}
            </div>
            <div className="flex gap-2">
              {f.kind === "BOOLEAN" ? (
                <MCSelect value={String(draft[f.key] ?? f.value)} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </MCSelect>
              ) : (
                <MCInput
                  value={draft[f.key] ?? String(f.value)}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  placeholder={f.note}
                  type={f.kind === "NUMBER" ? "number" : "text"}
                />
              )}
              <MCButton tone="gold" onClick={() => void save(f.key, f.kind, f.value)}>SIMPAN</MCButton>
            </div>
            {f.note ? <p className="mc-body text-[12px] text-white/45 mt-1">{f.note}</p> : null}
          </div>
        ))}
        {shown.length === 0 ? <p className="mc-body text-white/50">Tidak ada field pada grup ini — MCP dikelola di panel kanan.</p> : null}
      </MCPanel>

      <div className="grid gap-4">
        <MCPanel>
          <MCSectionTitle>UJI KONEKSI NYATA</MCSectionTitle>
          <div className="flex gap-2 mb-2">
            <MCButton tone="green" onClick={() => void runTest("minecraft")}>UJI MINECRAFT</MCButton>
            <MCButton tone="green" onClick={() => void runTest("supabase")}>UJI SUPABASE</MCButton>
          </div>
          <MCLog
            lines={testOut.map((t) => ({ text: `${t.ok ? "✓" : "✗"} ${t.name}: ${t.detail}`, tone: t.ok ? "ok" : "err" }))}
          />
          <p className="mc-body mt-2 text-[12px] text-black/60 dark:text-white/50">Uji Supabase memeriksa tabel, kolom, dan roundtrip tulis/baca/hapus — persis mandat #9.</p>
        </MCPanel>

        <MCPanel dark>
          <MCSectionTitle>SERVER MCP TERDAFTAR</MCSectionTitle>
          <MCLog
            lines={(s?.mcp ?? []).map((m) => ({
              text: `${m.name} [${m.transport}] ${m.endpoint} — ${m.enabled ? "aktif" : "mati"} · ${m.toolCount} tool · ${m.lastStatus}${m.lastError ? `: ${m.lastError}` : ""}`,
              tone: m.lastStatus === "OK" ? "ok" : m.lastStatus === "FAILED" ? "err" : "info",
            }))}
          />
          <div className="mt-2 grid gap-2">
            <MCInput value={mcpName} onChange={(e) => setMcpName(e.target.value)} placeholder="nama (mis. berita)" />
            <MCSelect value={mcpTransport} onChange={(e) => setMcpTransport(e.target.value)}>
              <option value="HTTP">HTTP (JSON-RPC POST)</option>
              <option value="STDIO">STDIO (spawn proses)</option>
            </MCSelect>
            <MCInput value={mcpEndpoint} onChange={(e) => setMcpEndpoint(e.target.value)} placeholder="URL / command" />
            <div className="flex gap-2">
              <MCButton tone="gold" disabled={!mcpName.trim() || !mcpEndpoint.trim()} onClick={() => void act("mcp_add", { name: mcpName, transport: mcpTransport, value: mcpEndpoint }, "mendaftarkan MCP…").then(() => { setMcpName(""); setMcpEndpoint(""); })}>DAFTAR</MCButton>
              <MCButton tone="green" disabled={!mcpName.trim()} onClick={() => void act("mcp_call", { name: mcpName }, "probe tools/list…")}>PROBE</MCButton>
              <MCButton tone="red" disabled={!mcpName.trim()} onClick={() => void act("mcp_remove", { name: mcpName }, "menghapus…")}>HAPUS</MCButton>
            </div>
          </div>
          <p className="mc-body mt-2 text-[12px] text-white/45">Warga NETRUNNER/TOOLSMITH memanggil MCP lewat Toolforge (tool mcp_call) — semua teraudit.</p>
        </MCPanel>
      </div>
    </div>
  );
}
