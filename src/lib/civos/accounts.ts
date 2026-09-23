// CIVITAS OS — accounts.ts
// Util akun ledger (lookup by org+kind/name).

import { db } from "@/lib/db";
import { accountBalance } from "./ledger";

export async function getAccount(orgId: string, kind: string) {
  return db.civAccount.findFirst({ where: { orgId, kind } });
}

export async function getAccounts(orgId: string) {
  const rows = await db.civAccount.findMany({ where: { orgId }, orderBy: { kind: "asc" } });
  const out: { id: string; kind: string; name: string; balance: number }[] = [];
  for (const r of rows) out.push({ id: r.id, kind: r.kind, name: r.name, balance: await accountBalance(r.id) });
  return out;
}

export async function accountByName(name: string) {
  return db.civAccount.findFirst({ where: { name } });
}
