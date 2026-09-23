"use client";
// CIVITAS OS — GuildView: guild kerja + TOOLFORGE (tool calling, internet nyata, MCP).

import { useState } from "react";
import { fmtFlr, MCBadge, MCButton, MCInput, MCLog, MCPanel, MCSectionTitle, MCSlot } from "../mcui";
import { useCiv, type ToolCallRec, type ArtifactRec } from "../McShell";
import { divisionMeta, DIVISION_META } from "../divmeta";

const TOOLS = ["web_search", "page_reader", "code_write", "spec_write", "build_plan", "mine_route", "patrol_report", "mcp_call"];

export default function GuildView() {
  const { s, act } = useCiv();
  const [tool, setTool] = useState("web_search");
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);

  const calls = (s?.tools?.calls ?? []) as ToolCallRec[];
  const arts = (s?.tools?.artifacts ?? []) as ArtifactRec[];
  const villagers = (s?.village?.villagers ?? []) as { code: string; name: string; division: string }[];
  const mcp = s?.mcp ?? [];

  const run = async () => {
    setRunning(true);
    const params: Record<string, unknown> = { tool };
    if (tool === "web_search" || tool === "page_reader") {
      if (tool === "web_search") params.query = input || "ekonomi desa nusantara";
      else params.url = input || "https://id.wikipedia.org/wiki/Desa";
    } else if (tool === "code_write") params.product = input || "modul irigasi";
    else if (tool === "spec_write") params.product = input || "aplikasi pasar desa";
    else if (tool === "build_plan") params.structure = input || "balai desa";
    else if (tool === "mcp_call") params.name = input || mcp[0]?.name || "kosong";
    const r = await act("tool_run", params, "toolforge bekerja…");
    setRunning(false);
    void r;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <MCPanel dark className="lg:col-span-2">
        <MCSectionTitle>TOOLFORGE — TOOL CALLING TERAUDIT</MCSectionTitle>
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={tool} onChange={(e) => setTool(e.target.value)} className="mc-body bg-[#191919] text-[color:var(--mc-xp)] border-[3px] border-[color:var(--mc-panel-dark)] px-2 py-1.5">
            {TOOLS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <MCInput className="flex-1 min-w-56" value={input} onChange={(e) => setInput(e.target.value)} placeholder="argumen (kueri / URL / nama / server MCP)" />
          <MCButton tone="gold" disabled={running} onClick={() => void run()}>JALANKAN TOOL</MCButton>
        </div>
        <MCLog
          lines={calls.map((c) => ({
            text: `[${c.status}] ${c.tool} — ${c.callerName} (${c.callerCode}): ${c.note ?? c.error ?? ""} · ${c.latencyMs}ms`,
            tone: c.status === "OK" ? "ok" : c.status === "DENIED" ? "warn" : "err",
          }))}
        />
        <p className="mc-body mt-2 text-[13px] text-white/50">Ghost tool & pelanggaran charter = DENIED tercatat. web_search/page_reader = internet NYATA (URL sumber terekam). mcp_call = JSON-RPC nyata ke server MCP terdaftar di tab KONFIG.</p>
      </MCPanel>

      <div className="grid gap-4">
        <MCPanel>
          <MCSectionTitle>PUSTAKA ARTEFAK</MCSectionTitle>
          <div className="mc-inset p-3 max-h-64 overflow-y-auto mc-scroll">
            {arts.length === 0 ? <p className="mc-body text-black/50">— belum ada artefak —</p> : arts.map((a) => (
              <div key={a.id} className="border-b border-black/20 py-1.5">
                <p className="mc-body text-[15px] text-black">{a.title}</p>
                <p className="mc-body text-[12px] text-black/60">{a.kind} · oleh {a.authorName} · {a.division}</p>
              </div>
            ))}
          </div>
        </MCPanel>

        <MCPanel dark>
          <MCSectionTitle>KATALOG WARGA PER DIVISI</MCSectionTitle>
          <div className="mc-inset-dark p-3 max-h-64 overflow-y-auto mc-scroll">
            {villagers.map((v) => (
              <p key={v.code} className="mc-body text-[15px] text-white/85 border-b border-white/10 py-1">
                {v.name} <span className="text-white/45">{v.code}</span> — <MCBadge tone="diamond">{v.division}</MCBadge>
              </p>
            ))}
          </div>
        </MCPanel>
      </div>

      <MCPanel className="lg:col-span-3">
        <MCSectionTitle>CHARTER DIVISI (otorisasi kernel — di luar LLM)</MCSectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(DIVISION_META).filter(([k]) => k !== "GENERAL").map(([k, meta]) => (
            <MCSlot key={k}>
              <p className="mc-font text-[9px] mb-1">{meta.label.toUpperCase()}</p>
              <p className="mc-body text-[13px] text-black/75">{meta.desc}</p>
              <p className="mc-body text-[12px] mt-1 text-black/60">Tools: {meta.tools.join(", ") || "—"}</p>
              <p className="mc-body text-[12px] text-black/60">Artefak: {meta.artifactKind}</p>
            </MCSlot>
          ))}
        </div>
      </MCPanel>
    </div>
  );
}
