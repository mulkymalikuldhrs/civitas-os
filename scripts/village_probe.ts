// CIVITAS OS — probe aksi villager BUY & PROPOSE_TO_GOV (jalur yang jarang dipilih LLM).
// Jalankan: bun scripts/village_probe.ts
import { db } from "../src/lib/db";
import { execBuy, execPropose } from "../src/lib/civos/village";
import { accountBalance } from "../src/lib/civos/ledger";

async function main() {
  const aji = await db.civVillager.findUniqueOrThrow({ where: { code: "VIL-0001" } });
  if (!aji.walletId) throw new Error("dompet Aji hilang");
  const before = await accountBalance(aji.walletId);
  console.log("saldo awal Aji:", before, "minor");

  // BUY: LLM mengusulkan 500 (di atas VILLAGER_MAX_TX=250 & saldo) → kernel harus clamp
  const buy = await execBuy({ id: aji.id, code: aji.code, name: aji.name, walletId: aji.walletId }, 500);
  console.log("BUY →", buy.summary, "| ledger:", buy.ledger);
  const afterBuy = await accountBalance(aji.walletId);
  const spent = before - afterBuy;
  console.log(`clamp check: usulan 500 → dibelanjakan ${spent} (harus ≤ 250)`);
  if (spent > 250) throw new Error("VILLAGER_MAX_TX dilanggar!");
  if (afterBuy < 0) throw new Error("saldo negatif!");

  // BUY kedua: saldo tinggal < clamp → harus menunda tanpa saldo negatif
  const buy2 = await execBuy({ id: aji.id, code: aji.code, name: aji.name, walletId: aji.walletId }, null);
  console.log("BUY#2 →", buy2.summary);

  // PROPOSE: suara warga masuk memori publik pemerintah + event
  const prop = await execPropose({ id: aji.id, code: aji.code, name: aji.name }, "Bangun irigasi desa supaya panen tidak bergantung hujan");
  console.log("PROPOSE →", prop.summary);

  const mem = await db.civMemory.findFirst({ where: { ownerType: "ORG", content: { contains: "irigasi desa" } }, orderBy: { createdAt: "desc" } });
  console.log("memori pemerintah tercatat:", Boolean(mem));
  if (!mem) throw new Error("usulan warga tak ditemukan di memori pemerintah!");

  const ev = await db.civEvent.findFirst({ where: { subjectId: aji.code, type: "PROPOSAL_SUBMITTED" }, orderBy: { seq: "desc" } });
  console.log("event PROPOSAL_SUBMITTED tercatat:", Boolean(ev));

  await db.$disconnect();
  console.log("PROBE OK");
}

main().catch((e) => {
  console.error("PROBE FAIL:", e);
  process.exit(1);
});
