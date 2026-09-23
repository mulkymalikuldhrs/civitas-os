// CIVITAS OS — ledger.ts
// Pembukuan double-entry otoritatif (PRD §20). Uang hanya tercipta via MINT.
// Konvensi: leg DEBIT = penerima, leg CREDIT = pemberi; balance akun = Σdebit − Σcredit.
// Setiap transaksi = 1 CivTxn + ≥2 CivEntry + 1 CivEvent, atomik dalam $transaction.

import { db } from "@/lib/db";
import { emit } from "./events";
import { checkTxLimit, getPolicy, PolicyViolation } from "./policy";
import { EVENT_TYPES, CURRENCY } from "./types";

export interface Leg {
  accountId: string;
  side: "DEBIT" | "CREDIT";
  amount: number;
}

export interface PostTxArgs {
  idempotencyKey: string;
  txType: string;
  purpose: string;
  legs: Leg[];
  actorAgentId?: string | null;
  isExternal?: boolean;
  counterparty?: string | null;
  eventType: string;
  subjectType?: string;
  subjectId?: string;
  meta?: Record<string, unknown>;
  /** org pembelanja untuk cek MAX_DAILY_SPEND (null = MINT/eksternal) */
  spendOrgId?: string | null;
  force?: boolean; // true = lewati cek limit (hanya untuk MINT & operasi kernel)
}

export interface PostTxResult {
  ok: boolean;
  duplicate?: boolean;
  txId?: string;
  eventId?: string;
  reason?: string;
}

/** Saldo satu akun (Σdebit − Σcredit). */
export async function accountBalance(accountId: string): Promise<number> {
  const agg = await db.civEntry.groupBy({
    by: ["side"],
    where: { accountId },
    _sum: { amount: true },
  });
  const d = agg.find((a) => a.side === "DEBIT")?._sum.amount ?? 0;
  const c = agg.find((a) => a.side === "CREDIT")?._sum.amount ?? 0;
  return d - c;
}

/** Invariant likuiditas: pengeluar wajib punya kas ≥ amount + buffer. Di luar jangkauan LLM. */
async function assertLiquidity(accountId: string, amount: number, buffer = 0): Promise<void> {
  const bal = await accountBalance(accountId);
  if (bal < amount + buffer) {
    throw new PolicyViolation("INSUFFICIENT_LIQUIDITY", `Kas tidak cukup: ${bal} < ${amount + buffer} (butuh ${amount} + buffer ${buffer})`);
  }
}

/** Saldo gabungan seluruh akun org. */
export async function orgBalance(orgId: string): Promise<number> {
  const accounts = await db.civAccount.findMany({ where: { orgId }, select: { id: true } });
  let sum = 0;
  for (const a of accounts) sum += await accountBalance(a.id);
  return sum;
}

/** Posting transaksi double-entry dengan invariant + idempotency. */
export async function postTx(args: PostTxArgs): Promise<PostTxResult> {
  const legs = args.legs;
  const debitSum = legs.filter((l) => l.side === "DEBIT").reduce((s, l) => s + l.amount, 0);
  const creditSum = legs.filter((l) => l.side === "CREDIT").reduce((s, l) => s + l.amount, 0);

  if (legs.length < 2) return { ok: false, reason: "Minimal 2 leg (double-entry)" };
  if (debitSum !== creditSum || debitSum <= 0) return { ok: false, reason: `Ledger tidak seimbang: DEBIT ${debitSum} ≠ CREDIT ${creditSum}` };
  if (!legs.every((l) => Number.isInteger(l.amount) && l.amount > 0)) return { ok: false, reason: "Semua amount wajib integer minor unit positif" };

  if (!args.force) {
    // Cek limit pada total nilai transaksi atas org pembelanja
    const firstDebit = legs.find((l) => l.side === "DEBIT");
    const acc = firstDebit ? await db.civAccount.findUnique({ where: { id: firstDebit.accountId } }) : null;
    const chk = await checkTxLimit(args.spendOrgId ?? acc?.orgId ?? null, debitSum);
    if (!chk.ok) {
      await emit({ type: EVENT_TYPES.POLICY_VIOLATION, subjectType: "TX", subjectId: args.idempotencyKey, payload: { reason: chk.reason, txType: args.txType } });
      return { ok: false, reason: chk.reason };
    }
  }

  const accounts = await db.civAccount.findMany({
    where: { id: { in: legs.map((l) => l.accountId) } },
  });
  if (accounts.length !== new Set(legs.map((l) => l.accountId)).size) return { ok: false, reason: "Ada accountId tak dikenal" };
  if (!accounts.every((a) => a.currency === CURRENCY)) return { ok: false, reason: "Semua akun wajib satu currency FLR" };

  try {
    const result = await db.$transaction(async (tx) => {
      const txn = await tx.civTxn.create({
        data: {
          idempotencyKey: args.idempotencyKey,
          txType: args.txType,
          purpose: args.purpose.slice(0, 300),
          actorAgentId: args.actorAgentId ?? null,
          isExternal: args.isExternal ?? false,
          counterparty: args.counterparty ?? null,
          meta: JSON.stringify(args.meta ?? {}).slice(0, 2048),
        },
      });
      await tx.civEntry.createMany({
        data: legs.map((l) => ({ txId: txn.id, side: l.side, amount: l.amount, accountId: l.accountId })),
      });
      return txn;
    });

    const seq = await emit({
      type: args.eventType,
      subjectType: args.subjectType ?? "TX",
      subjectId: args.subjectId ?? result.id,
      payload: { txId: result.id, txType: args.txType, amount: debitSum, purpose: args.purpose, isExternal: args.isExternal ?? false, counterparty: args.counterparty ?? null },
    });
    await db.civTxn.update({ where: { id: result.id }, data: { eventId: String(seq) } });
    return { ok: true, txId: result.id, eventId: String(seq) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      const existing = await db.civTxn.findUnique({ where: { idempotencyKey: args.idempotencyKey } });
      return { ok: true, duplicate: true, txId: existing?.id, reason: "Idempoten: kunci sudah pernah dipakai" };
    }
    return { ok: false, reason: msg.slice(0, 300) };
  }
}

// ---------- Operasi kanonik ----------

/** MINT: satu-satunya pintu kelahiran uang (event MINT wajib). */
export async function mint(treasuryAccountId: string, equityAccountId: string, amount: number, purpose: string, key: string): Promise<PostTxResult> {
  return postTx({
    idempotencyKey: key,
    txType: "MINT",
    purpose,
    eventType: EVENT_TYPES.MINT,
    subjectType: "NATION",
    subjectId: "NUSANTARA",
    legs: [
      { accountId: treasuryAccountId, side: "DEBIT", amount },
      { accountId: equityAccountId, side: "CREDIT", amount },
    ],
    force: true,
  });
}

/** Alokasi modal kas bangsa → kas operasional perusahaan. */
export async function allocateCapital(treasuryId: string, companyOperatingId: string, amount: number, actorAgentId: string | null, purpose: string, key: string): Promise<PostTxResult> {
  const reserveMin = (await getPolicy<number>("RESERVE_MIN")) ?? 50_000;
  await assertLiquidity(treasuryId, amount, reserveMin); // kas bangsa tak boleh jatuh di bawah cadangan
  return postTx({
    idempotencyKey: key,
    txType: "ALLOCATION",
    purpose,
    actorAgentId,
    eventType: EVENT_TYPES.CAPITAL_ALLOCATED,
    subjectType: "COMPANY",
    subjectId: companyOperatingId,
    legs: [
      { accountId: companyOperatingId, side: "DEBIT", amount },
      { accountId: treasuryId, side: "CREDIT", amount },
    ],
  });
}

/** Perdagangan internal antar perusahaan (4 leg) — BUKAN revenue eksternal. */
export async function tradeInternal(buyerOrgId: string, sellerOrgId: string, amount: number, purpose: string, key: string, actorAgentId?: string | null): Promise<PostTxResult> {
  const [buyerExp, buyerOp, sellerOp, sellerInc] = await Promise.all([
    db.civAccount.findFirst({ where: { orgId: buyerOrgId, kind: "EXPENSE" } }),
    db.civAccount.findFirst({ where: { orgId: buyerOrgId, kind: "OPERATING" } }),
    db.civAccount.findFirst({ where: { orgId: sellerOrgId, kind: "OPERATING" } }),
    db.civAccount.findFirst({ where: { orgId: sellerOrgId, kind: "INCOME" } }),
  ]);
  if (!buyerExp || !buyerOp || !sellerOp || !sellerInc) return { ok: false, reason: "Akun buyer/seller tidak lengkap" };
  try {
    await assertLiquidity(buyerOp.id, amount); // buyer tidak boleh berbelanja melebihi kas
  } catch (e) {
    return { ok: false, reason: e instanceof PolicyViolation ? e.message : "likuiditas buyer tidak cukup" };
  }
  return postTx({
    idempotencyKey: key,
    txType: "TRADE_INTERNAL",
    purpose,
    actorAgentId: actorAgentId ?? null,
    eventType: EVENT_TYPES.TRADE_INTERNAL,
    subjectType: "COMPANY",
    subjectId: sellerOrgId,
    spendOrgId: buyerOrgId,
    meta: { buyerOrgId, sellerOrgId, classification: "INTERNAL — bukan revenue eksternal" },
    legs: [
      { accountId: buyerExp.id, side: "DEBIT", amount },
      { accountId: buyerOp.id, side: "CREDIT", amount },
      { accountId: sellerOp.id, side: "DEBIT", amount },
      { accountId: sellerInc.id, side: "CREDIT", amount },
    ],
  });
}

/** Revenue eksternal: uang MASUK dari counterparty nyata (tercatat jujur; saat ini belum ada). */
export async function externalRevenue(companyOperatingId: string, companyEquityExternalId: string, amount: number, counterparty: string, purpose: string, key: string, actorAgentId?: string | null): Promise<PostTxResult> {
  return postTx({
    idempotencyKey: key,
    txType: "REVENUE_EXTERNAL",
    purpose,
    actorAgentId: actorAgentId ?? null,
    isExternal: true,
    counterparty,
    eventType: EVENT_TYPES.REVENUE_EXTERNAL,
    subjectType: "COMPANY",
    subjectId: companyOperatingId,
    meta: { external: true },
    legs: [
      { accountId: companyOperatingId, side: "DEBIT", amount },
      { accountId: companyEquityExternalId, side: "CREDIT", amount },
    ],
  });
}

/** Beban (mis. biaya infra/LLM) dari kas operasional. */
export async function expense(operatingId: string, expenseAccountId: string, amount: number, purpose: string, key: string, actorAgentId?: string | null): Promise<PostTxResult> {
  try {
    await assertLiquidity(operatingId, amount);
  } catch (e) {
    return { ok: false, reason: e instanceof PolicyViolation ? e.message : "kas operasional tidak cukup" };
  }
  return postTx({
    idempotencyKey: key,
    txType: "EXPENSE",
    purpose,
    actorAgentId: actorAgentId ?? null,
    eventType: EVENT_TYPES.EXPENSE,
    subjectType: "ACCOUNT",
    subjectId: operatingId,
    legs: [
      { accountId: expenseAccountId, side: "DEBIT", amount },
      { accountId: operatingId, side: "CREDIT", amount },
    ],
  });
}

/** Ringkasan ledger untuk UI. */
export async function ledgerRows(limit = 40) {
  const txns = await db.civTxn.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(limit, 100), include: { entries: { include: { account: true } } } });
  return txns.map((t) => ({
    id: t.id,
    txType: t.txType,
    purpose: t.purpose,
    isExternal: t.isExternal,
    counterparty: t.counterparty,
    amount: t.entries.filter((e) => e.side === "DEBIT" && e.account.kind !== "EXPENSE").reduce((s, e) => s + e.amount, 0) || t.entries.filter((e) => e.side === "DEBIT").reduce((s, e) => s + e.amount, 0) / 2,
    legs: t.entries.map((e) => ({ side: e.side, amount: e.amount, account: e.account.name, kind: e.account.kind })),
    createdAt: t.createdAt.toISOString(),
  }));
}

export { PolicyViolation };
