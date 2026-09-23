"use client";
// CIVITAS OS — GovView: 4 institusi + proposal + kebijakan + grant.

import { MCBadge, MCLog, MCPanel, MCSectionTitle, MCSlot } from "../mcui";
import { useCiv, type ProposalRec } from "../McShell";

export default function GovView() {
  const { s } = useCiv();
  const proposals = (s?.proposals ?? []) as ProposalRec[];
  const policies = s?.policies ?? [];
  const grants = s?.grants ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <MCPanel className="lg:col-span-2">
        <MCSectionTitle>PIPELINE PROPOSAL (LLM mengusulkan → institusi memutuskan)</MCSectionTitle>
        <MCLog
          lines={proposals.map((p) => ({
            text: `${p.status} · ${p.kind} · oleh ${p.institution}${p.orgCode ? ` @${p.orgCode}` : ""} — ${p.reason} (${p.createdAt.slice(5, 16)})`,
            tone: p.status === "EXECUTED" || p.status === "APPROVED" ? "ok" : p.status === "REJECTED" ? "err" : "info",
          }))}
        />
      </MCPanel>

      <MCPanel dark>
        <MCSectionTitle>INSTITUSI PEMERINTAHAN</MCSectionTitle>
        <MCLog
          lines={[
            { text: "REGULATORY — registrasi perusahaan, uji charter", tone: "info" },
            { text: "TREASURY — alokasi modal & anggaran (skor transparan)", tone: "info" },
            { text: "EXECUTIVE — pengadaan & eksekusi program", tone: "info" },
            { text: "TAX — pajak otomatis atas settlement eksternal", tone: "info" },
            { text: "Trias politica: tiga agen memeriksa satu sama lain.", tone: "warn" },
          ]}
        />
        <div className="mt-3 mc-inset-dark p-3">
          <p className="mc-font text-[9px] mb-2 text-[color:var(--mc-gold)]">GRANT CAPABILITY</p>
          {grants.length === 0 ? <p className="mc-body text-white/40">— belum ada grant —</p> : grants.map((g, i) => (
            <p key={i} className="mc-body text-[14px] text-white/80">{g.agentCode} → {g.capability} (cap {g.budgetCap})</p>
          ))}
        </div>
      </MCPanel>

      <MCPanel className="lg:col-span-3">
        <MCSectionTitle>KEBIJAKAN & LIMIT — DI LUAR LLM</MCSectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {policies.map((p) => (
            <MCSlot key={p.key}>
              <p className="mc-font text-[8px] text-black/70">{p.key}</p>
              <p className="mc-body text-[14px] text-black">{String(p.value).slice(0, 40)}</p>
              {p.note ? <p className="mc-body text-[11px] text-black/50">{p.note}</p> : null}
            </MCSlot>
          ))}
        </div>
      </MCPanel>
    </div>
  );
}
