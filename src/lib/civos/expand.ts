// CIVITAS OS — expand.ts
// Ekspansi peradaban (Slice 7+): kota kedua + kantor kuant (paper-trading SIMULASI berlabel).

import { db } from "@/lib/db";
import { emit } from "./events";
import { postTx } from "./ledger";
import { getAccount } from "./accounts";
import { grant } from "./policy";
import { EVENT_TYPES } from "./types";
import { safeParse } from "./events";

// ---------- KOTA KEDUA ----------

export async function createCity(name: string, spec: string): Promise<{ ok: boolean; code?: string; reason?: string }> {
  const count = (await db.civOrg.count({ where: { kind: "CITY" } })) + 1;
  const code = `KOTA-${String(count).padStart(2, "0")}`;
  const nation = await db.civOrg.findUnique({ where: { code: "NUSANTARA" } });
  const city = await db.civOrg.create({
    data: { code, kind: "CITY", name, lifecycle: "ACTIVE", specialization: spec, parentOrgId: nation?.id },
  });
  const treasury = await db.civAccount.create({ data: { orgId: city.id, kind: "TREASURY", name: `Kas ${name}` } });
  const mayor = await db.civAgent.create({
    data: { code: `CTY-MAY-${String(count).padStart(3, "0")}`, name: `Wali ${name}`, role: "MAYOR", orgId: city.id, authority: JSON.stringify({ pemeliharaan: true }), budgetCap: 50_000 },
  });
  await grant(mayor.id, "memory.write", 0);

  // Anggaran pendirian dari kas bangsa (TRANSFER — aksi pendirian kota oleh peradaban)
  const nationTre = nation ? await getAccount(nation.id, "TREASURY") : null;
  if (nationTre) {
    await postTx({
      idempotencyKey: `cityfounding-${code}-${Date.now()}`,
      txType: "TRANSFER",
      purpose: `Anggaran pendirian ${name} (${code})`,
      eventType: EVENT_TYPES.CITY_FOUNDED,
      subjectType: "CITY",
      subjectId: city.id,
      legs: [
        { accountId: treasury.id, side: "DEBIT", amount: 200_000 },
        { accountId: nationTre.id, side: "CREDIT", amount: 200_000 },
      ],
    });
  }

  // Entitas dunia (koordinat grid kanan kota pertama)
  const entities = [
    { mcType: "DISTRICT", mcName: name, coords: { x: 52, z: -6 }, civCode: code },
    { mcType: "STRUCTURE", mcName: `Dermaga ${name}`, coords: { x: 52, z: 12 }, civCode: code },
    { mcType: "BUILDING", mcName: `Balai Kota ${name}`, coords: { x: 46, z: -20 }, civCode: code },
  ];
  for (const e of entities) {
    await db.civWorldEntity.create({
      data: { mcType: e.mcType, mcName: e.mcName, mcCoords: JSON.stringify(e.coords), civType: "CITY", civId: city.id, civCode: e.civCode, status: "PLANNED" },
    });
  }
  await emit({ type: EVENT_TYPES.CITY_FOUNDED, subjectType: "CITY", subjectId: city.id, payload: { kode: code, nama: name, spesialisasi: spec, anggaran: 200_000 } });
  return { ok: true, code };
}

// ---------- KANTOR KUANT (PAPER-TRADING SIMULASI) ----------

export async function createQuantOffice(): Promise<{ ok: boolean; code?: string; reason?: string }> {
  const exists = await db.civOrg.findUnique({ where: { code: "COMP-QUAN" } });
  if (exists) return { ok: false, reason: "COMP-QUAN sudah ada" };
  const nation = await db.civOrg.findUnique({ where: { code: "NUSANTARA" } });
  const org = await db.civOrg.create({
    data: { code: "COMP-QUAN", kind: "COMPANY", name: "Kantor Kuant Nusantara", lifecycle: "PROPOSED", specialization: "Penelitian kuantitatif — PAPER-TRADING SIMULASI", parentOrgId: nation?.id },
  });
  await db.civAccount.create({ data: { orgId: org.id, kind: "OPERATING", name: "Kas Operasional COMP-QUAN" } });
  await db.civAccount.create({ data: { orgId: org.id, kind: "INCOME", name: "Pendapatan COMP-QUAN" } });
  await db.civAccount.create({ data: { orgId: org.id, kind: "EXPENSE", name: "Beban COMP-QUAN" } });
  const agent = await db.civAgent.create({
    data: { code: "QUA-001", name: "Analis Kuant", role: "QUANT-RESEARCH", orgId: org.id, authority: JSON.stringify({ paperTrading: true }), budgetCap: 50_000 },
  });
  await grant(agent.id, "memory.write", 0);
  await emit({ type: EVENT_TYPES.COMPANY_PROPOSED, subjectType: "COMPANY", subjectId: org.id, payload: { kode: "COMP-QUAN", catatan: "paper-trading SIMULASI — uang riil tidak tersentuh" } });
  return { ok: true, code: "COMP-QUAN" };
}

export interface QuantState {
  day: number;
  price: number; // harga simulasi (poin)
  pos: number; // posisi unit (paper)
  entry: number;
  pnlSim: number; // PnL kumulatif dalam POIN SIMULASI (bukan FLR, bukan uang)
  trades: { day: number; action: string; price: number; pnlSim: number }[];
  blocked?: string;
}

/** Siklus kuant deterministik: harga = gelombang sin (reproducible), strategi EMA-sederhana,
 *  risk gate di luar LLM (QUANT_MAX_POSITION). UANG RIIL/FLR TIDAK TERSentuh — PnL poin simulasi. */
export async function quantCycle(orgId: string): Promise<{ decision: string; state: QuantState; mode: "NYATA" | "PAUSED" }> {
  const { getConfigValue } = await import("./config");
  const priceUrl = await getConfigValue("quant.priceUrl");
  const QUANT_MAX_POSITION = 100; // unit — limit di luar LLM
  let st: QuantState = { day: 0, price: 100, pos: 0, entry: 0, pnlSim: 0, trades: [] };
  const kv = await db.civKV.findUnique({ where: { key: "quant.state" } });
  if (kv) {
    const parsed = safeParse(kv.value) as unknown as QuantState;
    if (typeof parsed.day === "number") st = parsed;
  }

  st.day += 1;
  // SLICE 10 ANTI-SIMULASI: harga dari API pasar NYATA (default Binance publik).
  // Gagal jaringan => PAUSED jujur; TIDAK ADA harga fiktif.
  let live = true;
  try {
    const res = await fetch(priceUrl, { signal: AbortSignal.timeout(8_000) });
    const j = (await res.json()) as { price?: string };
    const p = Number(j.price);
    if (!res.ok || !Number.isFinite(p) || p <= 0) throw new Error(String(res.status));
    st.price = Math.round(p * 100) / 100;
  } catch {
    live = false;
  }
  if (!live) {
    const decision = `Hari ${st.day} (PAUSED): sumber harga NYATA tidak terjangkau (${priceUrl.slice(0, 60)}) — kantor kuant menolak memutuskan dengan data fiktif`;
    await db.civKV.upsert({ where: { key: "quant.state" }, create: { key: "quant.state", value: JSON.stringify(st) }, update: { value: JSON.stringify(st) } });
    return { decision, state: st, mode: "PAUSED" };
  }
  const emaPrev = (kv ? ((safeParse(kv.value) as unknown as QuantState).price ?? st.price) : st.price);
  const ema = emaPrev * 0.7 + st.price * 0.3;

  let action = "HOLD";
  if (st.pos === 0 && st.price < ema * 0.99) { action = "BUY"; st.entry = st.price; st.pos = 50; }
  else if (st.pos > 0 && st.price > st.entry * 1.02) { action = "SELL"; const pnl = Math.round((st.price - st.entry) * st.pos * 100) / 100; st.pnlSim = Math.round((st.pnlSim + pnl) * 100) / 100; st.trades.unshift({ day: st.day, action: "SELL", price: st.price, pnlSim: pnl }); st.pos = 0; }
  else if (st.pos > 0 && st.price < st.entry * 0.97) { action = "STOP-LOSS"; const pnl = Math.round((st.price - st.entry) * st.pos * 100) / 100; st.pnlSim = Math.round((st.pnlSim + pnl) * 100) / 100; st.trades.unshift({ day: st.day, action: "STOP-LOSS", price: st.price, pnlSim: pnl }); st.pos = 0; st.blocked = "stop-loss menyala — posisi ditutup paksa (risk gate di luar LLM)"; }

  st.trades = st.trades.slice(0, 5);
  await db.civKV.upsert({
    where: { key: "quant.state" },
    create: { key: "quant.state", value: JSON.stringify(st) },
    update: { value: JSON.stringify(st) },
  });
  void QUANT_MAX_POSITION;
  const decision = `Hari ${st.day} (HARGA NYATA): ${st.price} · posisi ${st.pos} · aksi ${action} · PnL kertas kumulatif ${st.pnlSim} — keputusan pada data pasar nyata; eksekusi order butuh akun broker pemilik (gerbang)`;
  return { decision, state: st, mode: "NYATA" };
}
