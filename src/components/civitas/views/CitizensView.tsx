"use client";
// CIVITAS OS — CitizensView: warga + CHAT LANGSUNG (mandat #1) + tubuh/direktif.

import { useCallback, useEffect, useRef, useState } from "react";
import { fmtFlr, MCBadge, MCButton, MCInput, MCLog, MCPanel, MCSectionTitle, MCSlot, MCTabs } from "../mcui";
import { useCiv, type ChatRec, type VillagerRec } from "../McShell";
import { divisionMeta } from "../divmeta";

export default function CitizensView() {
  const { s, act } = useCiv();
  const villagers = (s?.village?.villagers ?? []) as VillagerRec[];
  const [tab, setTab] = useState("chat");
  const [target, setTarget] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState<ChatRec[]>([]);
  const [sending, setSending] = useState(false);
  const [autoPick, setAutoPick] = useState(true);
  const lastIdRef = useRef<string | null>(null);

  const loadChat = useCallback(async () => {
    try {
      const res = await fetch("/api/civos/chat?limit=50", { cache: "no-store" });
      const j = (await res.json()) as { ok: boolean; messages?: ChatRec[] };
      if (j.ok && j.messages) setChat(j.messages.slice().reverse());
    } catch { /* poll berikutnya */ }
  }, []);

  useEffect(() => {
    const t0 = setTimeout(() => void loadChat(), 0); // muat awal (aman dari cascading render)
    const t = setInterval(() => void loadChat(), 2500); // realtime
    return () => { clearInterval(t); clearTimeout(t0); };
  }, [loadChat]);

  const effectiveTarget = target
    || (autoPick ? (villagers.find((v) => v.source === "CENSUS")?.code ?? villagers[0]?.code ?? "") : "");

  const send = async () => {
    if (!effectiveTarget || !msg.trim()) return;
    setSending(true);
    const r = await act("chat_send", { villagerCode: effectiveTarget, body: msg.trim() }, `${effectiveTarget} sedang berpikir…`);
    setMsg("");
    setSending(false);
    if (r.reply) setFlashReply(String(r.reply));
    void loadChat();
  };
  const [flashReply, setFlashReply] = useState<string | null>(null);

  const feed = chat.map((c) => ({
    text: `${c.channel === "WORLD" ? "🌍" : c.from === "HUMAN" ? "🧑" : c.from === "CITIZEN" ? "🧑‍🌾" : "⚙"} ${c.senderName}${c.villagerCode ? ` (${c.villagerCode})` : ""}: ${c.body}${c.route && c.route !== "{}" ? `  — via ${safeModel(c.route)}` : ""}`,
    tone: c.from === "HUMAN" ? ("info" as const) : c.from === "CITIZEN" ? ("ok" as const) : ("warn" as const),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <MCPanel className="lg:col-span-2">
        <MCSectionTitle>BICARA LANGSUNG DENGAN WARGA</MCSectionTitle>
        <div className="flex flex-wrap gap-2 items-center mb-3">
          {autoPick ? null : (
            <select value={target} onChange={(e) => setTarget(e.target.value)} className="mc-body bg-[#191919] text-[color:var(--mc-xp)] border-[3px] border-[color:var(--mc-panel-dark)] px-2 py-1.5">
              {villagers.map((v) => <option key={v.code} value={v.code}>{v.name} ({v.code} · {v.division})</option>)}
            </select>
          )}
          <MCButton onClick={() => setAutoPick((a) => !a)}>{autoPick ? "PILIH OTOMATIS" : "PILIH MANUAL"}</MCButton>
          {effectiveTarget ? <MCBadge tone="diamond">tujuan: {effectiveTarget}</MCBadge> : null}
        </div>
        <MCLog lines={feed} className="!max-h-80 mb-3" />
        {flashReply ? <p className="mc-body text-[color:var(--mc-emerald)] text-[15px] mb-2">↩ {flashReply}</p> : null}
        <div className="flex gap-2">
          <MCInput
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !sending) void send(); }}
            placeholder="tulis pesan untuk warga… (Enter kirim)"
            maxLength={220}
          />
          <MCButton tone="gold" disabled={sending || !effectiveTarget || !msg.trim()} onClick={() => void send()}>KIRIM</MCButton>
        </div>
        <p className="mc-body mt-2 text-[13px] text-black/60">Balasan dari otak LLM warga (kepribadian + ingatan). Saat dunia online, balasan juga diucapkan in-game lewat direktif SPEAK; chat pemain di dunia dibaca bot dan dijawab otomatis.</p>
      </MCPanel>

      <div className="grid gap-4">
        <MCPanel dark>
          <MCSectionTitle>WARGA BERDENYUT ({villagers.length})</MCSectionTitle>
          <div className="mc-inset-dark p-3 max-h-72 overflow-y-auto mc-scroll">
            {villagers.map((v) => {
              const meta = divisionMeta(v.division);
              return (
                <button key={v.code} onClick={() => { setAutoPick(false); setTarget(v.code); }} className="w-full text-left border-b border-white/10 py-2 hover:bg-white/5 px-1">
                  <p className="mc-body text-[15px]">{v.name} <span className="text-white/50">({v.code})</span></p>
                  <p className="mc-body text-[12px] text-white/60">{meta.label} · {v.profession} · dompet {fmtFlr(v.wallet)} FLR</p>
                  <div className="mt-1 flex gap-1">
                    <MCBadge tone={v.source === "CENSUS" ? "green" : "gold"}>{v.source === "CENSUS" ? "NYATA" : "SIM"}</MCBadge>
                    <MCBadge tone={v.embodiment === "EMBODIED" ? "diamond" : "stone"}>{v.embodiment}</MCBadge>
                  </div>
                </button>
              );
            })}
          </div>
        </MCPanel>

        <MCPanel dark>
          <MCTabs tabs={[{ key: "tubuh", label: "TUBUH" }, { key: "pasar", label: "PASAR" }]} active={tab} onSelect={setTab} />
          {tab === "tubuh" ? (
            <MCLog
              className="mt-2"
              lines={((s?.village?.directives as { recent?: { kind?: string; status?: string; result?: string }[] } | undefined)?.recent ?? []).map((d) => ({
                text: `${d.kind ?? "?"} → ${d.status ?? "?"}: ${d.result ?? ""}`,
                tone: d.status === "APPLIED" ? "ok" : d.status === "FAILED" || d.status === "EXPIRED" ? "err" : "info",
              }))}
            />
          ) : (
            <MCLog
              className="mt-2"
              lines={((s?.village?.market as { offers?: { item?: string; unitPrice?: number; qtyAvailable?: number }[] } | undefined)?.offers ?? []).map((o) => ({
                text: `${o.item} @ ${fmtFlr(o.unitPrice)} FLR × ${o.qtyAvailable}`,
                tone: "info" as const,
              }))}
            />
          )}
        </MCPanel>
      </div>
    </div>
  );
}

function safeModel(route: string): string {
  try {
    const j = JSON.parse(route) as { model?: string };
    return j.model ?? "-";
  } catch {
    return "-";
  }
}
