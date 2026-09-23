// CIVITAS OS — economy.ts
// Sustainability engine (PRD §22/§31): runway, burn, konsentrasi, kejujuran revenue.
// Deteksi: burn tak berkelanjutan, konsentrasi satu perusahaan, TIDAK ADA revenue eksternal.

import { db } from "@/lib/db";
import { accountBalance, orgBalance } from "./ledger";
import { getAccount } from "./accounts";
import { getPolicy } from "./policy";
import { emit } from "./events";
import { EVENT_TYPES, KV_LAST_TICK } from "./types";
import { safeParse } from "./events";

export interface EconomyMetrics {
  moneySupply: number; // Σ MINT − Σ BURN
  treasury: number; // kas bangsa
  reserveMin: number;
  govCash: number;
  taxCollected: number;
  internalTradeVolume: number;
  externalRevenue: number; // riil + sandbox (total isExternal)
  externalRevenueReal: number; // jujur: 0 sampai ada customer nyata
  externalRevenueSandbox: number; // fixture uji rail [SANDBOX-TEST]
  externalRevenueByCompany: { orgCode: string; amount: number }[];
  expenses: number;
  llmInfraCost: number;
  companies: { code: string; name: string; lifecycle: string; operating: number; income: number; expense: number }[];
  runwayDays: number | null;
  concentrationTop: number; // pangsa perdagangan internal perusahaan teratas (0..1)
  alerts: string[];
  preRevenue: true; // penanda kejujuran MVP
}

export async function computeMetrics(): Promise<EconomyMetrics> {
  const nation = await db.civOrg.findUnique({ where: { code: "NUSANTARA" } });
  const gov = await db.civOrg.findUnique({ where: { code: "GOV" } });
  const reserveMin = (await getPolicy<number>("RESERVE_MIN")) ?? 50_000;

  const mintAgg = await db.civTxn.aggregate({ where: { txType: "MINT" }, _count: true });
  const mintSum = await sumTx("MINT");
  const burnSum = await sumTx("BURN");
  const taxSum = await sumTx("TAX");
  const intTrade = await sumTx("TRADE_INTERNAL");
  const extAll = await sumExternal();
  const extReal = await sumExternal(false);
  const extSandbox = await sumExternal(true);
  const expSum = await sumTx("EXPENSE");

  const companies = await db.civOrg.findMany({ where: { kind: "COMPANY" }, orderBy: { code: "asc" } });
  const companyRows: EconomyMetrics["companies"] = [];
  for (const c of companies) {
    const [op, inc, exp] = await Promise.all([
      getAccount(c.id, "OPERATING"),
      getAccount(c.id, "INCOME"),
      getAccount(c.id, "EXPENSE"),
    ]);
    companyRows.push({
      code: c.code,
      name: c.name,
      lifecycle: c.lifecycle,
      operating: op ? await accountBalance(op.id) : 0,
      income: inc ? await accountBalance(inc.id) : 0,
      expense: exp ? await accountBalance(exp.id) : 0,
    });
  }

  // Konsentrasi: pangsa INCOME teratas dari total income perusahaan
  const incomeSum = companyRows.reduce((s, c) => s + c.income, 0);
  const topIncome = companyRows.reduce((m, c) => Math.max(m, c.income), 0);
  const concentration = incomeSum > 0 ? topIncome / incomeSum : 0;

  const treasuryAcc = nation ? await getAccount(nation.id, "TREASURY") : null;
  const treasury = treasuryAcc ? await accountBalance(treasuryAcc.id) : 0;
  const govCash = gov ? await orgBalance(gov.id) : 0;

  // Runway kas bangsa: berapa hari tahan bila burn = expense+infra per hari (estimasi dari riil sejauh ini)
  const alerts: string[] = [];
  if (treasury < reserveMin) alerts.push(`Kas bangsa di bawah RESERVE_MIN (${treasury} < ${reserveMin})`);
  if (extReal === 0) alerts.push(extSandbox > 0 ? `Rail eksternal teruji via SANDBOX (${extSandbox}); revenue eksternal RIIL masih 0 — jujur` : "BELUM ADA REVENUE EKSTERNAL — status peradaban: PRE_REVENUE (jujur)");
  if (concentration > 0.7 && incomeSum > 0) alerts.push(`Konsentrasi tinggi: pangsa income teratas ${(concentration * 100).toFixed(0)}%`);

  const totalExp = expSum;
  const dailyBurn = Math.max(totalExp, 1); // estimasi konservatif
  const runwayDays = Math.floor(treasury / dailyBurn);

  return {
    moneySupply: mintSum - burnSum,
    treasury,
    reserveMin,
    govCash,
    taxCollected: taxSum,
    internalTradeVolume: intTrade,
    externalRevenue: extAll,
    externalRevenueReal: extReal,
    externalRevenueSandbox: extSandbox,
    externalRevenueByCompany: await externalByCompany(),
    expenses: expSum,
    llmInfraCost: expSum,
    companies: companyRows,
    runwayDays,
    concentrationTop: concentration,
    alerts,
    preRevenue: true,
  };
}

async function sumTx(txType: string): Promise<number> {
  const txns = await db.civTxn.findMany({ where: { txType }, select: { id: true } });
  if (txns.length === 0) return 0;
  const entries = await db.civEntry.findMany({
    where: { txId: { in: txns.map((t) => t.id) }, side: "DEBIT" },
    select: { amount: true, account: { select: { kind: true } } },
  });
  // nilai transaksi = Σ leg debit akun "riil" (bukan EXPENSE penerima) — untuk TRADE_INTERNAL ambil setengah
  const real = entries.filter((e) => e.account.kind !== "EXPENSE").reduce((s, e) => s + e.amount, 0);
  if (txType === "TRADE_INTERNAL") return real / 2;
  return real;
}

async function sumExternal(sandboxOnly?: boolean): Promise<number> {
  const txns = await db.civTxn.findMany({ where: { isExternal: true }, select: { id: true, meta: true } });
  const filtered = sandboxOnly === undefined ? txns : txns.filter((t) => {
    const m = safeParse(t.meta);
    return sandboxOnly ? m.sandbox === true : m.sandbox !== true;
  });
  if (filtered.length === 0) return 0;
  const entries = await db.civEntry.findMany({
    where: { txId: { in: filtered.map((t) => t.id) }, side: "DEBIT" },
    select: { amount: true },
  });
  return entries.reduce((s, e) => s + e.amount, 0);
}

async function externalByCompany(): Promise<{ orgCode: string; amount: number }[]> {
  const txns = await db.civTxn.findMany({ where: { isExternal: true }, select: { id: true, meta: true } });
  const map = new Map<string, number>();
  for (const t of txns) {
    const meta = safeParse(t.meta);
    const code = typeof meta.orgCode === "string" ? meta.orgCode : "?";
    const entries = await db.civEntry.findMany({ where: { txId: t.id, side: "DEBIT" }, select: { amount: true } });
    map.set(code, (map.get(code) ?? 0) + entries.reduce((s, e) => s + e.amount, 0));
  }
  return [...map.entries()].map(([orgCode, amount]) => ({ orgCode, amount }));
}

/** Emit alert sekali per jenis per jam (anti-spam event). */
export async function alertOncePerHour(metrics: EconomyMetrics): Promise<void> {
  const kv = await db.civKV.findUnique({ where: { key: KV_LAST_TICK } });
  const nowHour = new Date().toISOString().slice(0, 13);
  const last = kv ? safeParse(kv.value) : {};
  if (last.alertHour !== nowHour && metrics.alerts.length > 0) {
    await emit({ type: EVENT_TYPES.SUSTAINABILITY_ALERT, subjectType: "NATION", subjectId: "NUSANTARA", payload: { alerts: metrics.alerts } });
    await db.civKV.upsert({
      where: { key: KV_LAST_TICK },
      create: { key: KV_LAST_TICK, value: JSON.stringify({ alertHour: nowHour, at: new Date().toISOString() }) },
      update: { value: JSON.stringify({ alertHour: nowHour, at: new Date().toISOString() }) },
    });
  }
}
