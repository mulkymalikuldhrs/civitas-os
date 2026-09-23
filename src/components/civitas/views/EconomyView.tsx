"use client";
// CIVITAS OS — EconomyView: treasury, ledger double-entry, pajak, kuant (harga nyata).

import { fmtFlr, MCBadge, MCLog, MCPanel, MCSectionTitle, MCSlot } from "../mcui";
import { useCiv } from "../McShell";

export default function EconomyView() {
  const { s } = useCiv();
  const m = (s?.metrics ?? {}) as Record<string, unknown>;
  const ledger = s?.ledger ?? [];
  const quantState = ((s as Record<string, unknown>)?.quantState ?? null) as { day?: number; price?: number; pos?: number; pnlSim?: number } | null;

  const kpis = [
    { k: "KAS BANGSA", v: `${fmtFlr(Number(m.treasury ?? 0))} FLR` },
    { k: "PAJAK TERKUMPUL", v: `${fmtFlr(Number(m.taxCollected ?? 0))} FLR` },
    { k: "REVENUE RIIL", v: fmtFlr(Number(m.externalRevenueReal ?? 0)) },
    { k: "REVENUE SANDBOX", v: fmtFlr(Number(m.externalRevenueSandbox ?? 0)) },
    { k: "MINT", v: fmtFlr(Number(m.minted ?? 0)) },
    { k: "TXN TOTAL", v: String(s?.counts.txns ?? 0) },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <MCPanel dark className="lg:col-span-3">
        <MCSectionTitle>TERASURERI NUSANTARA</MCSectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {kpis.map((k) => (
            <MCSlot key={k.k} dark>
              <p className="mc-font text-[8px] text-white/60">{k.k}</p>
              <p className="mc-font text-[12px] mt-1">{k.v}</p>
            </MCSlot>
          ))}
        </div>
      </MCPanel>

      <MCPanel className="lg:col-span-2">
        <MCSectionTitle>LEDGER DOUBLE-ENTRY (ΣDEBIT = ΣCREDIT, selalu)</MCSectionTitle>
        <MCLog
          lines={ledger.map((l) => ({
            text: `${l.at.slice(5, 16)} · ${l.txType}${l.isExternal ? " [EKSTERNAL]" : ""} · ${l.purpose} · ${l.account}: ${l.debit ? `D ${fmtFlr(Number(l.debit))}` : l.credit ? `K ${fmtFlr(Number(l.credit))}` : fmtFlr(Number(l.amount))}`,
            tone: l.isExternal ? "ok" : "info",
          }))}
          className="!max-h-96"
        />
      </MCPanel>

      <div className="grid gap-4">
        <MCPanel>
          <MCSectionTitle>KANTOR KUANT — HARGA PASAR NYATA</MCSectionTitle>
          {quantState ? (
            <>
              <p className="mc-body text-[15px] text-black">Hari {quantState.day} · harga {quantState.price} · posisi {quantState.pos}</p>
              <p className="mc-body text-[13px] text-black/60">PnL kertas: {quantState.pnlSim} — keputusan pada harga API pasar nyata (Binance publik).</p>
              <MCBadge tone="xp">DATA NYATA</MCBadge> <MCBadge tone="gold">EKSEKUSI ORDER = GERBANG PEMILIK</MCBadge>
            </>
          ) : (
            <p className="mc-body text-black/60">Kantor kuant belum aktif — dirikan lewat denyut pemerintah.</p>
          )}
        </MCPanel>

        <MCPanel dark>
          <MCSectionTitle>ATURAN UANG</MCSectionTitle>
          <MCLog
            lines={[
              { text: "FLR = florin, integer minor (1 FLR = 100)." },
              { text: "Trade internal ≠ revenue eksternal — meteran terpisah, jujur." },
              { text: "Pajak otomatis 10% atas settlement eksternal." },
              { text: "Likuiditas + RESERVE_MIN dijaga di luar LLM." },
              { text: "Uang tidak pernah muncul/k hilang tanpa jejak.", tone: "warn" },
            ]}
          />
        </MCPanel>
      </div>
    </div>
  );
}
