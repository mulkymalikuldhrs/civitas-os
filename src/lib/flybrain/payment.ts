// FLYBRAIN KERNEL — payment.ts
// Deteksi pembayaran dari kwitansi yang disimpan user sendiri (04 §4-5).
// Jujur secara kriptografis: sig = checksum integritas format, bukan bukti tak-terpalsukan.

import { sha256HexFromStr as sha256Hex } from "./crypto";
import type { Receipt, Tier } from "./types";

const ORDER: (keyof Receipt)[] = [
  "schema",
  "receipt_id",
  "issued_at",
  "period_months",
  "tier",
  "payer",
  "amount",
  "channel",
];

/** Kanonikalisasi rekursif (audit F-13): key objek diurutkan di SEMUA level —
 * urutan properti nested tidak lagi memengaruhi checksum. */
function canonicalValue(v: unknown): string {
  if (v === null || typeof v !== "object") return String(v);
  if (Array.isArray(v)) return `[${v.map(canonicalValue).join(",")}]`;
  const obj = v as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${k}:${canonicalValue(obj[k])}`)
    .join(",")}}`;
}

function canonicalize(r: Receipt): string {
  const parts: string[] = [];
  for (const k of ORDER) {
    parts.push(`${k}=${canonicalValue(r[k])}`);
  }
  return parts.join("\u001f"); // unit separator
}

export async function computeSig(r: Omit<Receipt, "sig">): Promise<string> {
  const canonical = canonicalize({ ...r, sig: "" });
  return sha256Hex(`flybrain-os-v1\u001e${canonical}`);
}

export interface ReceiptVerdict {
  valid: boolean;
  reason: string;
  tier: Tier | null;
  until: string | null;
}

export async function validateReceipt(
  raw: unknown,
  username: string,
): Promise<ReceiptVerdict> {
  let r: Receipt;
  try {
    r = (typeof raw === "string" ? JSON.parse(raw) : raw) as Receipt;
  } catch {
    return { valid: false, reason: "Kwitansi bukan JSON yang sah.", tier: null, until: null };
  }
  const fail = (reason: string): ReceiptVerdict => ({ valid: false, reason, tier: null, until: null });

  if (!r || typeof r !== "object") return fail("Struktur kwitansi tidak dikenali.");
  if (r.schema !== "flybrain.receipt/v1") return fail("schema bukan flybrain.receipt/v1.");
  if (!r.receipt_id || typeof r.receipt_id !== "string") return fail("receipt_id wajib ada.");
  if (r.tier !== "PRO" && r.tier !== "FREE") return fail("tier tidak dikenal.");
  if (r.payer !== username) return fail(`payer harus cocok dengan username aktif (${username}).`);
  const issued = new Date(r.issued_at);
  if (Number.isNaN(issued.getTime())) return fail("issued_at bukan tanggal ISO yang sah.");
  if (typeof r.period_months !== "number" || r.period_months <= 0 || r.period_months > 24)
    return fail("period_months harus angka 1-24.");
  if (!r.amount || typeof r.amount.value !== "number" || r.amount.value < 0)
    return fail("amount.value tidak sah.");
  if (!["demo", "manual", "stripe", "xendit"].includes(r.channel))
    return fail("channel tidak dikenal.");

  const expect = await computeSig(r);
  if (expect !== r.sig)
    return fail("Checksum (sig) tidak cocok — kwitansi rusak atau dipalsukan.");

  const until = new Date(issued.getTime() + r.period_months * 30 * 24 * 3600 * 1000);
  if (until.getTime() < Date.now())
    return fail(`Kwitansi kedaluwarsa pada ${until.toISOString().slice(0, 10)}.`);

  return {
    valid: true,
    reason: "Kwitansi valid — terdeteksi di data lokal Anda.",
    tier: r.tier,
    until: until.toISOString(),
  };
}

/** Kwitansi demo resmi (dengan sig benar) untuk mencoba alur tanpa transaksi nyata. */
export async function demoReceipt(username: string): Promise<Receipt> {
  const base: Omit<Receipt, "sig"> = {
    schema: "flybrain.receipt/v1",
    receipt_id: `RC-DEMO-${Date.now().toString(36).toUpperCase()}`,
    issued_at: new Date().toISOString(),
    period_months: 1,
    tier: "PRO",
    payer: username,
    amount: { currency: "USD", value: 19 },
    channel: "demo",
  };
  return { ...base, sig: await computeSig(base) };
}
