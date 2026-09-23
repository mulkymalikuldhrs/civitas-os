"use client";
// CIVITAS OS — CompaniesView: lifecycle 13 state + akun + kota + aksi pendirian.

import { useState } from "react";
import { fmtFlr, MCBadge, MCButton, MCInput, MCLog, MCPanel, MCSectionTitle, MCSlot } from "../mcui";
import { useCiv, type OrgRec } from "../McShell";

const LIFECYCLE_ORDER = ["PROPOSED", "REGISTERED", "CAPITALIZED", "ACTIVE", "GROWING", "PROFITABLE", "UNPROFITABLE", "CAPITAL_CONSTRAINED", "DORMANT", "RESTRUCTURING", "LIQUIDATING", "BANKRUPT", "DISSOLVED"];

export default function CompaniesView() {
  const { s, act } = useCiv();
  const [name, setName] = useState("");
  const [cityName, setCityName] = useState("");
  const orgs = s?.orgs ?? [];
  const companies = orgs.filter((o) => o.kind === "COMPANY");
  const cities = orgs.filter((o) => o.kind === "CITY");

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <MCPanel className="lg:col-span-2">
        <MCSectionTitle>PERUSAHAAN — 13 STATE LIFECYCLE</MCSectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {companies.map((o: OrgRec) => {
            const stage = LIFECYCLE_ORDER.indexOf(o.lifecycle);
            const cash = o.accounts.filter((a) => a.kind === "OPERATING").reduce((t, a) => t + a.balance, 0);
            return (
              <MCSlot key={o.id}>
                <div className="flex items-center justify-between mb-1">
                  <p className="mc-font text-[9px]">{o.code} · {o.name.toUpperCase()}</p>
                  <MCBadge tone={stage >= 3 && stage <= 5 ? "green" : stage <= 1 ? "gold" : "stone"}>{o.lifecycle}</MCBadge>
                </div>
                <p className="mc-body text-[13px] text-black/70">{o.specialization ?? "—"}</p>
                <p className="mc-body text-[14px] mt-1">Kas operasional: <b>{fmtFlr(cash)} FLR</b></p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {o.accounts.slice(0, 4).map((a) => (
                    <MCBadge key={a.id} tone={a.kind === "INCOME" ? "green" : a.kind === "EXPENSE" ? "red" : "stone"}>{a.kind} {fmtFlr(a.balance)}</MCBadge>
                  ))}
                </div>
              </MCSlot>
            );
          })}
          {companies.length === 0 ? <p className="mc-body text-black/50">— belum ada perusahaan —</p> : null}
        </div>
      </MCPanel>

      <div className="grid gap-4">
        <MCPanel dark>
          <MCSectionTitle>DIRIKAN PERUSAHAAN BARU</MCSectionTitle>
          <MCInput value={name} onChange={(e) => setName(e.target.value)} placeholder="nama usaha" />
          <MCButton tone="gold" className="mt-2 w-full" disabled={!name.trim()} onClick={() => void act("register_company", { name, specialization: "Umum" }, "mendaftarkan…").then(() => setName(""))}>DAFTARKAN</MCButton>
          <p className="mc-body mt-2 text-[12px] text-white/50">REGULATORY yang memvalidasi lewat denyut — bukan pintu belakang.</p>
        </MCPanel>

        <MCPanel dark>
          <MCSectionTitle>KOTA</MCSectionTitle>
          <div className="flex flex-wrap gap-1 mb-2">
            {cities.map((c) => <MCBadge key={c.id} tone="gold">{c.code} {c.name}</MCBadge>)}
          </div>
          <MCInput value={cityName} onChange={(e) => setCityName(e.target.value)} placeholder="nama kota baru" />
          <MCButton tone="green" className="mt-2 w-full" disabled={!cityName.trim()} onClick={() => void act("create_city", { name: cityName, specialization: "Kota baru peradaban" }, "merancang kota…").then(() => setCityName(""))}>DIRIKKAN KOTA</MCButton>
        </MCPanel>
      </div>

      <MCPanel className="lg:col-span-3">
        <MCSectionTitle>PASAR DESA</MCSectionTitle>
        <MCLog
          lines={(((s?.village as Record<string, unknown> | undefined)?.market as { offers?: { item: string; unitPrice: number; qtyAvailable: number; qtySold?: number }[] } | undefined)?.offers ?? []).map((o) => ({
            text: `${o.item} — ${fmtFlr(o.unitPrice)} FLR · sisa ${o.qtyAvailable} · terjual ${o.qtySold ?? 0}`,
            tone: "info" as const,
          }))}
        />
      </MCPanel>
    </div>
  );
}
