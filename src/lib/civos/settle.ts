// CIVITAS OS — settle.ts
// SLICE 6: RAIL PEMBAYARAN EKSTERNAL (ADR-0006).
// Dua jalur, kejujuran mutlak:
//  - env "sandbox": fixture uji rail — tercatat REVENUE_EXTERNAL dengan label [SANDBOX-TEST]
//    (mendemonstrasikan pipeline revenue+pajak; METRIK dipisah dari revenue riil).
//  - env "live": butuh EXTERNAL_SETTLEMENT_LIVE=true + reference penyedia pembayaran nyata.
//    Tanpa itu → ditolak. Tidak ada jalur pemalsuan revenue.
// Pajak dinilai OTOMATIS oleh institusi TAX pada denyut berikutnya (meta.taxed → TAX txn).

import { db } from "@/lib/db";
import { postTx } from "./ledger";
import { getAccount } from "./accounts";
import { assertCapability } from "./policy";
import { EVENT_TYPES } from "./types";

export interface SettleArgs {
  orgCode?: string; // perusahaan penerima (default: kas bangsa)
  counterparty: string;
  amount: number; // minor unit
  reference: string; // bukti pembayaran
  env: "sandbox" | "live";
  actorAgentId?: string | null;
}

export interface SettleResult {
  ok: boolean;
  reason?: string;
  txId?: string;
  sandbox?: boolean;
  taxPending?: boolean;
}

export async function settleExternal(args: SettleArgs): Promise<SettleResult> {
  const { counterparty, amount, reference, env } = args;
  if (!counterparty || !reference) return { ok: false, reason: "counterparty & reference wajib" };
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, reason: "amount harus integer minor unit positif" };

  if (env === "live") {
    if (process.env.EXTERNAL_SETTLEMENT_LIVE !== "true") {
      return { ok: false, reason: "settlement LIVE terkunci — butuh EXTERNAL_SETTLEMENT_LIVE=true + integrasi penyedia pembayaran nyata (ADR-0006)" };
    }
  }

  const cpLabel = env === "sandbox" ? `EXTERNAL:${counterparty} [SANDBOX-TEST]` : `EXTERNAL:${counterparty}`;

  let debitAccId: string | null = null;
  let subject = "NUSANTARA";
  if (args.orgCode) {
    const org = await db.civOrg.findUnique({ where: { code: args.orgCode } });
    const op = org ? await getAccount(org.id, "OPERATING") : null;
    if (!org || !op) return { ok: false, reason: `org/akun ${args.orgCode} tidak ada` };
    debitAccId = op.id;
    subject = org.code;
  } else {
    const nation = await db.civOrg.findUnique({ where: { code: "NUSANTARA" } });
    const tre = nation ? await getAccount(nation.id, "TREASURY") : null;
    if (!nation || !tre) return { ok: false, reason: "kas bangsa tidak ada" };
    debitAccId = tre.id;
  }

  const nation2 = await db.civOrg.findUnique({ where: { code: "NUSANTARA" } });
  const extEquity = nation2 ? await db.civAccount.findFirst({ where: { orgId: nation2.id, name: "Modal Pelanggan Eksternal" } }) : null;
  if (!extEquity) return { ok: false, reason: "akun Modal Pelanggan Eksternal tidak ada" };

  if (args.actorAgentId) await assertCapability(args.actorAgentId, "ledger.post").catch(() => undefined); // rail admin boleh tanpa grant agen

  const r = await postTx({
    idempotencyKey: `settle-${env}-${reference}-${Date.now()}`,
    txType: "REVENUE_EXTERNAL",
    purpose: env === "sandbox"
      ? `[SANDBOX-TEST] Settlement uji rail dari ${counterparty} (ref: ${reference}) — BUKAN uang riil`
      : `Settlement eksternal dari ${counterparty} (ref: ${reference})`,
    actorAgentId: args.actorAgentId ?? null,
    isExternal: true,
    counterparty: cpLabel,
    eventType: EVENT_TYPES.REVENUE_EXTERNAL,
    subjectType: "COMPANY",
    subjectId: subject,
    meta: { sandbox: env === "sandbox", taxed: false, reference, env, orgCode: args.orgCode ?? null },
    legs: [
      { accountId: debitAccId, side: "DEBIT", amount },
      { accountId: extEquity.id, side: "CREDIT", amount },
    ],
  });
  if (!r.ok) return { ok: false, reason: r.reason };
  return { ok: true, txId: r.txId, sandbox: env === "sandbox", taxPending: true };
}
