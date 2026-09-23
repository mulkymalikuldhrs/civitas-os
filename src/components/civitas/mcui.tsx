"use client";
// CIVITAS OS — mcui.tsx: primitif UI Minecraft (panel, tombol, slot, tab, bar).
// Estetika dunia nyata: bevel keras, palet MC, tanpa gradasi generik.

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function MCPanel({ className, children, dark, ...rest }: HTMLAttributes<HTMLDivElement> & { dark?: boolean }) {
  return (
    <div className={cn(dark ? "mc-panel-dark" : "mc-panel", "p-4 text-[color:var(--mc-ink)]", dark && "text-white", className)} {...rest}>
      {children}
    </div>
  );
}

export function MCSectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("mc-font text-[11px] uppercase tracking-wider text-[color:var(--mc-gold)] mb-3", className)}>{children}</h3>;
}

type BtnTone = "stone" | "gold" | "green" | "red";
export function MCButton({ tone = "stone", className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: BtnTone }) {
  const toneCls = tone === "gold" ? "mc-btn-gold" : tone === "green" ? "mc-btn-green" : tone === "red" ? "mc-btn-red" : "";
  return (
    <button className={cn("mc-btn text-[11px] sm:text-xs", toneCls, className)} {...rest}>
      {children}
    </button>
  );
}

export function MCBadge({ children, tone = "stone", className }: { children: ReactNode; tone?: BtnTone | "diamond" | "xp"; className?: string }) {
  const map: Record<string, string> = {
    stone: "bg-[#6f6f74] text-white",
    gold: "bg-[color:var(--mc-gold)] text-black",
    green: "bg-[color:var(--mc-emerald)] text-black",
    red: "bg-[color:var(--mc-redstone)] text-white",
    diamond: "bg-[color:var(--mc-diamond)] text-black",
    xp: "bg-[color:var(--mc-xp)] text-black",
  };
  return <span className={cn("mc-font text-[8px] px-2 py-1 border-2 border-black/60 inline-flex items-center gap-1", map[tone], className)}>{children}</span>;
}

export function MCBar({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));
  return <div className={cn("mc-bar", className)} style={{ ["--v" as string]: `${pct}%` }}><i /></div>;
}

export function MCSlot({ children, className, dark }: { children: ReactNode; className?: string; dark?: boolean }) {
  return <div className={cn(dark ? "mc-inset-dark" : "mc-inset", "p-3", className)}>{children}</div>;
}

export function MCField({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block mb-3">
      <span className="mc-font text-[9px] text-[color:var(--mc-gold)] block mb-1">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] opacity-70 mt-1 mc-body">{hint}</span> : null}
    </label>
  );
}

export function MCInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("w-full bg-[#191919] text-[color:var(--mc-xp)] border-[3px] border-[color:var(--mc-panel-dark)] outline-none px-3 py-2 mc-body text-base focus:border-[color:var(--mc-gold)] placeholder:text-[#56565c]", className)} {...rest} />;
}

export function MCSelect({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("w-full bg-[#191919] text-[color:var(--mc-xp)] border-[3px] border-[color:var(--mc-panel-dark)] outline-none px-3 py-2 mc-body text-base focus:border-[color:var(--mc-gold)]", className)} {...rest}>
      {children}
    </select>
  );
}

/** Tab gaya inventori Minecraft (huruf kecil pixel). */
export function MCTabs({ tabs, active, onSelect, className }: { tabs: { key: string; label: string }[]; active: string; onSelect: (k: string) => void; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onSelect(t.key)}
          className={cn(
            "mc-font text-[9px] px-3 py-2 border-[3px] transition-none",
            active === t.key
              ? "bg-[color:var(--mc-oak)] text-black border-[#e6c78a] border-b-[color:var(--mc-ink)] border-r-[color:var(--mc-ink)]"
              : "bg-[#4a4a4e] text-white/80 border-[#6a6a70] border-b-[color:var(--mc-ink)] border-r-[color:var(--mc-ink)] hover:bg-[#5a5a60]",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Baris monospace gaya log dunia. */
export function MCLog({ lines, className }: { lines: { text: string; tone?: "ok" | "warn" | "err" | "info" }[]; className?: string }) {
  const toneCls = (t?: string) =>
    t === "ok" ? "text-[color:var(--mc-xp)]" : t === "warn" ? "text-[color:var(--mc-gold)]" : t === "err" ? "text-[color:var(--mc-redstone)]" : "text-white/85";
  return (
    <div className={cn("mc-inset-dark p-3 max-h-72 overflow-y-auto mc-scroll mc-body text-[15px] leading-snug", className)}>
      {lines.length === 0 ? <p className="text-white/40">— belum ada catatan —</p> : lines.map((l, i) => (
        <p key={i} className={cn("whitespace-pre-wrap break-words", toneCls(l.tone))}>{l.text}</p>
      ))}
    </div>
  );
}

export function fmtFlr(minor: number | null | undefined): string {
  const v = (minor ?? 0) / 100;
  return v.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
