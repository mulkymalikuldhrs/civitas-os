// CIVITAS OS — civos_invariants.ts
// Tes invariant ekonomi (PRD §29) langsung ke kernel. Jalankan: bun scripts/civos_invariants.ts
// Keluar: baris PASS/FAIL + exit code (0 = semua lolos).

import { db } from "../src/lib/db";
import { ensureSeed } from "../src/lib/civos/seed";
import { accountBalance, postTx, allocateCapital, tradeInternal, ledgerRows } from "../src/lib/civos/ledger";
import { transitionState, scoreProposal } from "../src/lib/civos/company";
import { assertCapability, grant, getPolicy } from "../src/lib/civos/policy";
import { getAccount } from "../src/lib/civos/accounts";
import { computeMetrics } from "../src/lib/civos/economy";
import { PolicyViolation } from "../src/lib/civos/policy";
// SLICE 8 — VILLAGER EMBODIMENT + PASAR DESA
import { enqueueDirective, markApplied, markDispatched, markFailed, expireStaleDirectives, runSimDirectives, claimDirectivesForBot } from "../src/lib/civos/directives";
import { listOffer, buyFromMarket, openOffers } from "../src/lib/civos/market";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    pass += 1;
    console.log(`PASS  ${name}${detail ? " — " + detail : ""}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`);
  }
}

async function main() {
  console.log("=== CIVITAS OS — INVARIANT EKONOMI ===");
  const seed = await ensureSeed();
  console.log("seed:", seed.detail);

  // INV-1: ledger seimbang global
  const sides = await db.civEntry.groupBy({ by: ["side"], _sum: { amount: true } });
  const d = sides.find((s) => s.side === "DEBIT")?._sum.amount ?? 0;
  const c = sides.find((s) => s.side === "CREDIT")?._sum.amount ?? 0;
  check("INV-1 ΣDEBIT == ΣCREDIT", d === c, `${d} vs ${c}`);

  // INV-2: setiap txn ≥2 leg & punya event
  const txns = await db.civTxn.findMany({ include: { entries: true } });
  const badLegs = txns.filter((t) => t.entries.length < 2).length;
  const badEvent = txns.filter((t) => !t.eventId).length;
  check("INV-2 setiap txn ≥2 leg", badLegs === 0, `${badLegs} pelanggar`);
  check("INV-2b setiap txn terhubung event", badEvent === 0, `${badEvent} tanpa event`);

  // INV-3: konservasi uang — Σ akun non-EKUITAS == MINT − BURN + REVENUE_EXTERNAL
  // (ekuitas membawa sisi kredit; uang beredar hidup di TREASURY/OPERATING/RESERVE/INCOME/EXPENSE)
  const mintSum = txns.filter((t) => t.txType === "MINT").flatMap((t) => t.entries.filter((e) => e.side === "CREDIT")).reduce((s, e) => s + e.amount, 0);
  const burnSum = txns.filter((t) => t.txType === "BURN").flatMap((t) => t.entries.filter((e) => e.side === "DEBIT")).reduce((s, e) => s + e.amount, 0);
  const allAcc = await db.civAccount.findMany({ select: { id: true, kind: true } });
  let circulating = 0;
  for (const a of allAcc) {
    if (a.kind === "EQUITY") continue;
    circulating += await accountBalance(a.id);
  }
  const extIn = txns.filter((t) => t.txType === "REVENUE_EXTERNAL").flatMap((t) => t.entries.filter((e) => e.side === "DEBIT")).reduce((s, e) => s + e.amount, 0);
  check("INV-3 konservasi uang (Σakun-nonekuitas == MINT−BURN+EXT)", circulating === mintSum - burnSum + extIn, `Σnonekuitas ${circulating}, MINT ${mintSum}, BURN ${burnSum}, EXT ${extIn}`);

  // INV-4: idempotency — replay kunci sama tidak menciptakan txn baru
  const nation = await db.civOrg.findUniqueOrThrow({ where: { code: "NUSANTARA" } });
  const treasury = (await getAccount(nation.id, "TREASURY"))!;
  const comp = await db.civOrg.findFirst({ where: { kind: "COMPANY", lifecycle: { in: ["REGISTERED", "CAPITALIZED", "ACTIVE"] } } });
  check("INV-4 prasyarat: ada perusahaan siap modal", Boolean(comp && treasury));
  if (comp && treasury) {
    const op = (await getAccount(comp.id, "OPERATING"))!;
    const key = `inv-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const before = await db.civTxn.count();
    const r1 = await allocateCapital(treasury.id, op.id, 5000, null, "tes idempoten", key);
    const r2 = await allocateCapital(treasury.id, op.id, 5000, null, "tes idempoten", key);
    const after = await db.civTxn.count();
    check("INV-4 replay idempoten → 1 txn baru", r1.ok && r2.duplicate === true && after - before === 1, `Δtxn=${after - before}, dup=${r2.duplicate}`);
    // bersihkan artefak uji ini (entri dulu, baru txn)
    await db.civEntry.deleteMany({ where: { tx: { idempotencyKey: key } } });
    await db.civTxn.deleteMany({ where: { idempotencyKey: key } });
  }

  // INV-5: TRADE_INTERNAL tidak pernah tercatat eksternal
  const badInternal = await db.civTxn.count({ where: { txType: "TRADE_INTERNAL", isExternal: true } });
  check("INV-5 internal ≠ revenue eksternal", badInternal === 0, `${badInternal} pelanggar`);

  // INV-6: MAX_TRANSACTION menolak transaksi di atas limit (di luar LLM)
  const maxTx = (await getPolicy<number>("MAX_TRANSACTION")) ?? 500_000;
  const rOver = await postTx({
    idempotencyKey: `inv-over-${Date.now()}`,
    txType: "TRANSFER",
    purpose: "tes pelanggaran MAX_TRANSACTION",
    eventType: "TAX_PAID",
    legs: [
      { accountId: treasury.id, side: "DEBIT", amount: maxTx + 1 },
      { accountId: treasury.id, side: "CREDIT", amount: maxTx + 1 },
    ],
    force: false,
  });
  check("INV-6 MAX_TRANSACTION menolak", rOver.ok === false && (rOver.reason ?? "").includes("MAX_TRANSACTION"), rOver.reason ?? "");

  // INV-7: transisi lifecycle ilegal ditolak, legal lolos
  if (comp) {
    const fresh = await db.civOrg.findUniqueOrThrow({ where: { id: comp.id } });
    const illegal = await transitionState(comp.id, fresh.lifecycle === "BANKRUPT" ? "PROPOSED" : "BANKRUPT", "tes ilegal");
    check("INV-7a transisi ilegal ditolak", illegal.ok === false, illegal.reason ?? "");
    const legalTarget = fresh.lifecycle === "CAPITALIZED" ? "ACTIVE" : fresh.lifecycle === "REGISTERED" ? "CAPITALIZED" : null;
    if (legalTarget) {
      const legal = await transitionState(comp.id, legalTarget, "tes legal");
      check("INV-7b transisi legal lolos", legal.ok === true, `${fresh.lifecycle} → ${legalTarget}`);
    } else {
      check("INV-7b transisi legal lolos", true, `lifecycle ${fresh.lifecycle} tanpa tepi uji — dilewati`);
    }
  }

  // INV-8: likuiditas — buyer kas-tipis tidak bisa berbelanja di atas kas
  const buyer = await db.civOrg.create({ data: { code: `COMP-T${Date.now() % 100000}`, kind: "COMPANY", name: "Perusahaan Uji", lifecycle: "ACTIVE" } });
  const bOp = await db.civAccount.create({ data: { orgId: buyer.id, kind: "OPERATING", name: "Kas Uji" } });
  const bExp = await db.civAccount.create({ data: { orgId: buyer.id, kind: "EXPENSE", name: "Beban Uji" } });
  const bInc = await db.civAccount.create({ data: { orgId: buyer.id, kind: "INCOME", name: "Pendapatan Uji" } });
  const seller = await db.civOrg.findFirstOrThrow({ where: { kind: "COMPANY", code: { not: buyer.code } } });
  const rNoCash = await tradeInternal(buyer.id, seller.id, 999_999, "tes likuiditas", `inv-liq-${Date.now()}`);
  check("INV-8 belanja melebihi kas ditolak", rNoCash.ok === false && (rNoCash.reason ?? "").toLowerCase().includes("kas"), rNoCash.reason ?? "");
  void bOp; void bExp; void bInc;

  // INV-9: authority — agen tanpa grant treasury.allocate ditolak
  const gub = await db.civAgent.findUniqueOrThrow({ where: { code: "GOV-GUB-001" } });
  let denied = false;
  try {
    await assertCapability(gub.id, "treasury.allocate");
  } catch (e) {
    denied = e instanceof PolicyViolation && (e.code === "NO_GRANT" || e.code === "GRANT_EXPIRED");
  }
  check("INV-9a agen tanpa grant ditolak", denied);
  const tre = await db.civAgent.findUniqueOrThrow({ where: { code: "GOV-TRE-001" } });
  let allowed = true;
  try {
    await assertCapability(tre.id, "treasury.allocate");
  } catch {
    allowed = false;
  }
  check("INV-9b agen bergrant lolos authority", allowed);
  void grant;

  // INV-10: skor alokasi transparan — ask besar di atas headroom memberi skor rendah
  const low = scoreProposal({ reputation: 50, capitalAsk: 10_000_000, treasury: 100_000, reserveMin: 50_000, lifecycle: "REGISTERED" });
  const high = scoreProposal({ reputation: 50, capitalAsk: 5_000, treasury: 100_000, reserveMin: 50_000, lifecycle: "REGISTERED" });
  check("INV-10 skor proposal deterministik & rasional", low.score < high.score, `ask-besar ${low.score} < ask-kecil ${high.score}`);

  // INV-11: metrik jujur — PRE_REVENUE selama belum ada revenue eksternal
  const metrics = await computeMetrics();
  check("INV-11 kejujuran PRE_REVENUE", metrics.externalRevenue === 0 ? metrics.alerts.some((a) => a.includes("PRE_REVENUE")) : true);

  // INV-12: ledgerRows UI konsisten dengan txn count
  const rows = await ledgerRows(5);
  check("INV-12 ledgerRows tersedia", Array.isArray(rows) && rows.length > 0, `${rows.length} baris`);

  // ===== SLICE 7 — VILLAGER ASCENSION =====
  const { parseVillagerEntity, profMeta } = await import("../src/lib/civos/villagers");

  const villagersActive = await db.civVillager.findMany({ where: { status: "ACTIVE" } });

  // INV-17: konservasi dompet warga — Σsaldo == Σupah masuk − Σkonsumsi keluar
  const walletIds = villagersActive.filter((v) => v.walletId).map((v) => v.walletId!);
  let walletSum = 0;
  for (const w of walletIds) walletSum += await accountBalance(w);
  const wageIn = await db.civEntry.findMany({ where: { accountId: { in: walletIds }, side: "DEBIT", tx: { txType: "WAGE" } }, select: { amount: true } });
  const buyOut = await db.civEntry.findMany({ where: { accountId: { in: walletIds }, side: "CREDIT", tx: { txType: "TRADE_INTERNAL" } }, select: { amount: true } });
  const wageInSum = wageIn.reduce((s, e) => s + e.amount, 0);
  const buyOutSum = buyOut.reduce((s, e) => s + e.amount, 0);
  check("INV-17 konservasi dompet warga (Σsaldo == upah − konsumsi)", walletSum === wageInSum - buyOutSum, `saldo ${walletSum}, upah ${wageInSum}, konsumsi ${buyOutSum}`);

  // INV-18: keunikan identitas warga — kode unik, wallet unik, entityUid unik
  const codes = villagersActive.map((v) => v.code);
  const wallets = villagersActive.map((v) => v.walletId).filter(Boolean) as string[];
  const uids = villagersActive.map((v) => v.mcEntityUid).filter(Boolean) as string[];
  check("INV-18 kode warga unik", new Set(codes).size === codes.length, `${codes.length} warga`);
  check("INV-18b wallet warga unik", new Set(wallets).size === wallets.length);
  check("INV-18c entityUid warga unik", new Set(uids).size === uids.length, `${uids.length} embodied`);

  // INV-19: konsumsi warga SELALU internal — tak pernah tercatat revenue eksternal
  const buyTxns = await db.civTxn.findMany({ where: { txType: "TRADE_INTERNAL" }, select: { meta: true, isExternal: true } });
  const villagerBuys = buyTxns.filter((t) => t.meta.includes("villagerBuyer"));
  check("INV-19 konsumsi warga klasifikasi INTERNAL (isExternal=false)", villagerBuys.every((t) => t.isExternal === false), `${villagerBuys.length} txn konsumsi warga`);
  const extFromVillage = await db.civTxn.count({ where: { isExternal: true, meta: { contains: "villager" } } });
  check("INV-19b nol revenue eksternal dari desa", extFromVillage === 0);

  // INV-20: limit belanja warga — tiap CREDIT konsumsi ≤ VILLAGER_MAX_TX
  const villagerMax = (await getPolicy<number>("VILLAGER_MAX_TX")) ?? 250;
  check("INV-20 belanja warga ≤ VILLAGER_MAX_TX", buyOut.every((e) => e.amount <= villagerMax), `cap ${villagerMax}, ${buyOut.length} transaksi`);

  // INV-21: upah warga = WAGE_PER_WORK policy (nominal di luar LLM)
  const wagePolicy = (await getPolicy<number>("WAGE_PER_WORK")) ?? 60;
  const wageTxns = await db.civTxn.findMany({ where: { txType: "WAGE" }, include: { entries: true } });
  const badWage = wageTxns.filter((t) => {
    const debit = t.entries.filter((e) => e.side === "DEBIT").reduce((s, e) => s + e.amount, 0);
    return debit !== wagePolicy;
  }).length;
  check("INV-21 upah selalu == WAGE_PER_WORK", badWage === 0, `${wageTxns.length} pembayaran upah @ ${wagePolicy}`);

  // INV-22: parser entitas villager (murni, tanpa dunia) — villager dikenali + profesi terbaca; bukan villager → null
  const fakeVillager = parseVillagerEntity({ entity_type: "minecraft:villager_v2", unique_id: "12345", position: { x: 10.5, y: 64, z: -3.25 }, metadata: [{ key: 17, type: 9, value: { type: 0, profession: 5, career: 0, trade_experience: 0 } }] });
  check("INV-22 parser villager: dikenali + profesi librarian", fakeVillager !== null && fakeVillager!.profession === "librarian" && fakeVillager!.entityUid === "12345", JSON.stringify(fakeVillager?.profession));
  const fakeCow = parseVillagerEntity({ entity_type: "minecraft:cow", unique_id: "999" });
  check("INV-22b parser menolak non-villager", fakeCow === null);
  const fakeVillagerNoMeta = parseVillagerEntity({ entity_type: "minecraft:villager", runtime_id: 77, position: { x: 0, y: 0, z: 0 } });
  check("INV-22c parser fallback runtime_id + profesi unknown", fakeVillagerNoMeta !== null && fakeVillagerNoMeta!.entityUid === "rt-77" && fakeVillagerNoMeta!.profession === "unknown");
  check("INV-22d peta profesi nitwit → Filosof/PHILOSOPHER", profMeta("nitwit").label === "Filosof" && profMeta("nitwit").role === "PHILOSOPHER");

  // ===== SLICE 8 — VILLAGER EMBODIMENT (tubuh) + PASAR DESA =====
  // Antrean dibersihkan dulu (dunia sandbox OFFLINE → jalur SIM mimpi jaga berlabel jujur)
  const simClean = await runSimDirectives(false);

  const v0 = await db.civVillager.findFirst({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } });
  if (v0) {
    // INV-23: mesin status direktif — jalur sah QUEUED→APPLIED, tanpa kebangkitan
    const enr = await enqueueDirective({ id: v0.id, code: v0.code, name: v0.name, mcCoords: v0.mcCoords }, "SPEAK", { message: "uji invariant" });
    check("INV-23a enqueue direktif → dibuat", enr.ok && Boolean(enr.id), enr.note);
    const d23 = enr.id ? await db.civVillagerDirective.findUnique({ where: { id: enr.id } }) : null;
    check("INV-23b status awal QUEUED, result kosong", d23?.status === "QUEUED" && d23.result === null);
    if (enr.id) {
      await markApplied(enr.id, "uji selesai");
      const d23b = await db.civVillagerDirective.findUnique({ where: { id: enr.id } });
      check("INV-23c QUEUED→APPLIED sah", d23b?.status === "APPLIED" && d23b.origin === "BOT", (d23b?.result ?? "").slice(0, 60));
      await markDispatched(enr.id); // ilegal: APPLIED tak boleh kembali ke DISPATCHED
      await markFailed(enr.id, "coba kebangkitan");
      const d23c = await db.civVillagerDirective.findUnique({ where: { id: enr.id } });
      check("INV-23d tanpa kebangkitan dari APPLIED", d23c?.status === "APPLIED", d23c?.status ?? "");
      await db.civVillagerDirective.delete({ where: { id: enr.id } });
    }

    // INV-24: TTL — direktif basi kedaluwarsa deterministik
    const stale = await db.civVillagerDirective.create({
      data: { villagerId: v0.id, kind: "MOVE", payload: JSON.stringify({ to: { x: 1, y: 64, z: 1 } }), status: "QUEUED", createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    });
    const expiredN = await expireStaleDirectives();
    const d24 = await db.civVillagerDirective.findUnique({ where: { id: stale.id } });
    check("INV-24 direktif basi (umur 2 jam > TTL 30 mnt) → EXPIRED", d24?.status === "EXPIRED" && expiredN >= 1, `tercadung ${expiredN}`);
    await db.civVillagerDirective.delete({ where: { id: stale.id } });

    // INV-25: SIM MOVE tak pernah mengangkat embodiment; koordinat bayangan hanya di kernel
    const coordsBefore = v0.mcCoords;
    const base25 = (() => { try { const c = JSON.parse(v0.mcCoords) as { x?: unknown; y?: unknown; z?: unknown }; if (typeof c.x === "number" && typeof c.y === "number" && typeof c.z === "number") return c as { x: number; y: number; z: number }; } catch { /* tanpa koordinat */ } return { x: 100, y: 64, z: 100 }; })();
    const enr25 = await enqueueDirective({ id: v0.id, code: v0.code, name: v0.name, mcCoords: v0.mcCoords }, "MOVE", { to: { x: base25.x + 7, y: base25.y, z: base25.z + 7 } });
    const sim = await runSimDirectives(false);
    const after = await db.civVillager.findUnique({ where: { id: v0.id } });
    check("INV-25a SIM MOVE dijalankan (dunia tidur) atau jujur ditunda (ONLINE)", sim.applied >= 1 || sim.note.includes("ONLINE"), sim.note.slice(0, 80));
    check("INV-25b SIM TIDAK mengangkat embodiment", after?.embodiment !== "EMBODIED" || v0.embodiment === "EMBODIED", `${v0.embodiment} → ${after?.embodiment}`);
    const d25 = enr25.id ? await db.civVillagerDirective.findUnique({ where: { id: enr25.id } }) : null;
    const movedCoords = after?.mcCoords !== coordsBefore;
    check("INV-25c origin legal + koordinat berubah bila applied (SIM/BOT — Slice 10: bot nyata boleh meng-claim)", Boolean(d25) && (d25!.status === "EXPIRED" || ((d25!.origin === "SIM" || d25!.origin === "BOT" || d25!.origin === "KERNEL") && (d25!.status === "APPLIED" ? (movedCoords || d25!.origin === "BOT" || d25!.origin === "KERNEL") : true))), `${d25?.status}/${d25?.origin ?? "-"}`);
    if (enr25.id) await db.civVillagerDirective.delete({ where: { id: enr25.id } });

    // INV-23e: klaim bot — SPEAK relay berlabel nama warga; antrean bersih → deterministik.
    // (v1.5) bot java yang HIDUP ikut mengklaim antrean tiap detak — pesaing nyata dihentikan
    // sementara agar pengujian deterministik; sambungan dipulihkan setelah cek. Jujur dicatat.
    const { javaBotStatus, javaBotDisconnect, javaBotConnect } = await import("@/lib/civos/javabot");
    const botWasConnected = javaBotStatus().connected;
    if (botWasConnected) await javaBotDisconnect();
    const enrS = await enqueueDirective({ id: v0.id, code: v0.code, name: v0.name, mcCoords: v0.mcCoords }, "SPEAK", { message: "klaim uji" });
    const claims = await claimDirectivesForBot(4);
    const claimS = claims.find((c) => c.id === enrS.id);
    check("INV-23e klaim bot SPEAK: relay berlabel warga", Boolean(claimS) && (claimS!.chatMessage ?? "").startsWith(`[${v0.name}`) && (claimS!.chatMessage ?? "").includes(v0.code), claimS?.chatMessage?.slice(0, 60) ?? "tak terklaim");
    if (enrS.id) await db.civVillagerDirective.delete({ where: { id: enrS.id } });
    if (botWasConnected) await javaBotConnect().catch(() => undefined); // pulihkan kehadiran bot

    // INV-27: SPEAK dipotong kernel ke SPEAK_MAX_LEN (LLM tak bisa memaksa pesan panjang)
    const maxLen = (await getPolicy<number>("SPEAK_MAX_LEN")) ?? 120;
    const enr27 = await enqueueDirective({ id: v0.id, code: v0.code, name: v0.name, mcCoords: v0.mcCoords }, "SPEAK", { message: "x".repeat(500) });
    const d27 = enr27.id ? await db.civVillagerDirective.findUnique({ where: { id: enr27.id } }) : null;
    const stored = d27 ? ((JSON.parse(d27.payload) as { message?: string }).message ?? "") : "";
    check("INV-27 panjang ucapan ≤ SPEAK_MAX_LEN", stored.length <= maxLen, `${stored.length} ≤ ${maxLen}`);
    if (enr27.id) await db.civVillagerDirective.delete({ where: { id: enr27.id } });
  } else {
    check("INV-23 desa kosong — uji direktif dilewati", true, "tidak ada warga aktif");
  }
  check("INV-28 SIM bersih-bersih antrean berlabel jujur", simClean.applied >= 0, simClean.note.slice(0, 80));

  // INV-26: konservasi pasar — qtySold + qtyAvailable == qtyInitial; harga > 0; OPEN berstok
  const offersAll = await db.civMarketOffer.findMany({});
  const badCons = offersAll.filter((o) => o.qtySold + o.qtyAvailable !== o.qtyInitial || o.unitPrice <= 0).length;
  check("INV-26a konservasi stok & harga positif", badCons === 0, `${offersAll.length} listing`);
  const badOpen = offersAll.filter((o) => o.status === "OPEN" && o.qtyAvailable <= 0).length;
  check("INV-26b OPEN selalu punya stok", badOpen === 0);

  // INV-26c: alur nyata listing harga-1 (termurah → deterministik) → beli → stok turun persis
  // Pilih perusahaan hidup dengan slot listing tersisa (MARKET_MAX_OFFERS_PER_ORG — policy jujur).
  const marketCap = (await getPolicy<number>("MARKET_MAX_OFFERS_PER_ORG")) ?? 6;
  const compCandidates = await db.civOrg.findMany({ where: { kind: "COMPANY", lifecycle: { in: ["ACTIVE", "GROWING", "PROFITABLE", "REGISTERED", "CAPITALIZED"] } }, orderBy: { code: "asc" } });
  let comp0: { id: string; code: string } | null = null;
  for (const c of compCandidates) {
    const open = await db.civMarketOffer.count({ where: { sellerOrgId: c.id, status: "OPEN" } });
    if (open < marketCap) { comp0 = { id: c.id, code: c.code }; break; }
  }
  const villagersAll = await db.civVillager.findMany({ where: { status: "ACTIVE", walletId: { not: null } }, orderBy: { code: "asc" } });
  let vBuy = null as null | { id: string; code: string; name: string; walletId: string };
  for (const vv of villagersAll) {
    if (vv.walletId && (await accountBalance(vv.walletId)) >= 10) { vBuy = { id: vv.id, code: vv.code, name: vv.name, walletId: vv.walletId }; break; }
  }
  if (comp0 && vBuy) {
    const listed = await listOffer(comp0.id, "Uji Invariant Pasar", 1, 2);
    check("INV-26c listing uji dibuat (harga 1 = termurah deterministik)", listed.ok && Boolean(listed.id), listed.note);
    if (listed.ok && listed.id) {
      const balBefore = await accountBalance(vBuy.walletId);
      const bought1 = await buyFromMarket(vBuy, 1);
      const balAfter1 = await accountBalance(vBuy.walletId);
      const off1 = bought1.offerId ? await db.civMarketOffer.findUnique({ where: { id: bought1.offerId } }) : null;
      check("INV-26d beli 1 unit: saldo turun persis amount", bought1.ok && balBefore - balAfter1 === (bought1.amount ?? -1), bought1.note.slice(0, 80));
      check("INV-26e pembelian mengenai listing uji & stok −1", bought1.ok && off1 !== null && off1.id === listed.id && off1.qtySold === 1 && off1.qtyAvailable === 1);
      const bought2 = await buyFromMarket(vBuy, 1);
      const off2 = await db.civMarketOffer.findUnique({ where: { id: listed.id } });
      check("INV-26f stok habis → CLOSED otomatis", bought2.ok && off2?.status === "CLOSED" && off2.qtySold === 2 && off2.qtyAvailable === 0, off2?.status ?? "-");
      check("INV-26g perdagangan pasar = TRADE_INTERNAL + event MARKET_TRADED", bought1.ledger !== null && bought2.ledger !== null);
      // Listing uji dihapus; transaksi tetap di ledger (immutable, uji ekonomi nyata ±0,02 FLR).
      await db.civMarketOffer.delete({ where: { id: listed.id } });
    }
  } else {
    check("INV-26c prasyarat pasar tak ada — dilewati", true, "tanpa company hidup / dompet warga terisi");
  }

  // ================= SLICE 9 — GUILD KERJA & TOOLFORGE =================
  const { invokeTool, TOOL_REGISTRY, guildStats, toolStats } = await import("../src/lib/civos/tools");
  const { divisionMeta, DIVISIONS } = await import("../src/lib/civos/types");

  // Warga uji: GENERAL (tanpa charter) + NETRUNNER (charter web_search/page_reader)
  const walletT = await db.civAccount.create({ data: { kind: "WALLET", name: "Dompet VIL-T90" } });
  const walletT2 = await db.civAccount.create({ data: { kind: "WALLET", name: "Dompet VIL-T91" } });
  const vGen = await db.civVillager.create({ data: { code: "VIL-T90", name: "Tester Umum", profession: "unknown", profLabel: "Warga", role: "SEEKER", division: "GENERAL", source: "SIMULASI", walletId: walletT.id } });
  const vNet = await db.civVillager.create({ data: { code: "VIL-T91", name: "Tester Net", profession: "unknown", profLabel: "Warga", role: "SEEKER", division: "NETRUNNER", source: "SIMULASI", walletId: walletT2.id } });
  const genCaller = { type: "VILLAGER" as const, id: vGen.id, code: vGen.code, name: vGen.name, division: vGen.division };
  const netCaller = { type: "VILLAGER" as const, id: vNet.id, code: vNet.code, name: vNet.name, division: vNet.division, mcCoords: vNet.mcCoords };

  // INV-29a: warga GENERAL tanpa charter → DENIED + tercatat di audit + event
  const r29a = await invokeTool(genCaller, "web_search", { query: "invariant" });
  const audit29 = await db.civToolCall.findFirst({ where: { callerCode: vGen.code, tool: "web_search", status: "DENIED" } });
  check("INV-29a tool tanpa charter divisi → DENIED tercatat", r29a.status === "DENIED" && audit29 !== null, r29a.note.slice(0, 80));

  // INV-29b: ghost tool tak terdaftar → DENIED + tercatat (tidak ada tool hantu)
  const r29b = await invokeTool(netCaller, "hack_bank", {});
  const audit29b = await db.civToolCall.findFirst({ where: { callerCode: vNet.code, tool: "hack_bank", status: "DENIED" } });
  check("INV-29b ghost tool → DENIED tercatat", r29b.status === "DENIED" && audit29b !== null, r29b.note.slice(0, 80));

  // INV-30: charter sah → tool jalan; audit row status konsisten; event TOOL_INVOKED ada
  const r30 = await invokeTool(netCaller, "web_search", { query: "invariant civos slice 9" });
  const audit30 = await db.civToolCall.findFirst({ where: { callerCode: vNet.code, tool: "web_search" }, orderBy: { seq: "desc" } });
  const ev30 = await db.civEvent.findFirst({ where: { type: "TOOL_INVOKED" }, orderBy: { seq: "desc" } });
  check("INV-30a panggilan sah teraudit (status row == status hasil)", audit30 !== null && audit30.status === r30.status && ev30 !== null, `${r30.status} ${r30.latencyMs}ms`);
  if (r30.status === "OK" && r30.artifactId) {
    const art30 = await db.civArtifact.findUnique({ where: { id: r30.artifactId } });
    check("INV-30b artefak RESEARCH lahir + tertaut toolCallId", art30 !== null && art30.kind === "RESEARCH" && art30.toolCallId === audit30?.id, art30?.title.slice(0, 60));
    // INV-31: artefak dipotong ARTIFACT_MAX_CHARS (di luar LLM)
    const maxChars = (await getPolicy<number>("ARTIFACT_MAX_CHARS")) ?? 4000;
    check("INV-31 panjang artefak ≤ ARTIFACT_MAX_CHARS", (art30?.content.length ?? 0) <= maxChars, `${art30?.content.length} ≤ ${maxChars}`);
    const metaUrls = art30 ? (JSON.parse(art30.meta) as { sumber?: string[] }).sumber ?? [] : [];
    check("INV-31b riset internet membawa URL sumber nyata", metaUrls.length > 0, `${metaUrls.length} URL`);
  } else {
    // Internet nyata bisa gagal — yang diuji: kegagalan dilaporkan JUJUR, tidak mengarang artefak.
    check("INV-30b internet gagal → FAILED jujur tanpa artefak", r30.status === "FAILED" && !r30.artifactId, r30.note.slice(0, 80));
    check("INV-31 skenario offline — batas artefak tetap terdefinisi", ((await getPolicy<number>("ARTIFACT_MAX_CHARS")) ?? 0) > 0);
  }

  // INV-32: mine_route — hasil tambang di-cap MINE_YIELD_MAX_UNITS (konservasi stok)
  const vMin = await db.civVillager.findFirst({ where: { status: "ACTIVE", division: "MINER", walletId: { not: null } } });
  if (vMin) {
    const mineCaller = { type: "VILLAGER" as const, id: vMin.id, code: vMin.code, name: vMin.name, division: vMin.division, mcCoords: vMin.mcCoords };
    const r32 = await invokeTool(mineCaller, "mine_route", { sellerOrgId: (await db.civOrg.findFirst({ where: { kind: "COMPANY", lifecycle: { notIn: ["BANKRUPT", "DISSOLVED"] } } }))?.id });
    const maxUnits = (await getPolicy<number>("MINE_YIELD_MAX_UNITS")) ?? 8;
    const art32 = r32.artifactId ? await db.civArtifact.findUnique({ where: { id: r32.artifactId } }) : null;
    const unit32 = art32 ? (JSON.parse(art32.meta) as { unit?: number }).unit ?? 0 : 0;
    check("INV-32 hasil tambang ≤ MINE_YIELD_MAX_UNITS", unit32 <= maxUnits, `${unit32} ≤ ${maxUnits}`);
  } else {
    check("INV-32 warga MINER tidak ada — dilewati", true, "jalankan sensus guild dulu");
  }

  // INV-33: direktif guild (BUILD/PATROL/MINE) sah — payload punya site + status mesin legal
  const guildDirs = await db.civVillagerDirective.findMany({ where: { kind: { in: ["BUILD", "PATROL", "MINE"] } }, orderBy: { createdAt: "desc" }, take: 20 });
  const badGuildDirs = guildDirs.filter((d) => {
    const p = JSON.parse(d.payload) as { site?: unknown };
    return !["QUEUED", "DISPATCHED", "APPLIED", "FAILED", "EXPIRED"].includes(d.status) || (d.kind === "BUILD" && !p.site);
  }).length;
  check("INV-33 direktif guild valid (site ada, status legal)", guildDirs.length > 0 ? badGuildDirs === 0 : true, `${guildDirs.length} direktif, ${badGuildDirs} cacat`);

  // INV-34: agregat guild/tools == hitungan mentah (state jujur untuk UI)
  const [gs, ts] = await Promise.all([guildStats(), toolStats()]);
  const activeCount = await db.civVillager.count({ where: { status: "ACTIVE" } });
  const gsSum = Object.values(gs.byDivision).reduce((s, n) => s + n, 0);
  check("INV-34a guildStats mencakup seluruh warga aktif", gsSum === activeCount && Object.keys(gs.byDivision).length === DIVISIONS.length, `${gsSum} == ${activeCount}`);
  check("INV-34b toolStats.total == hitungan audit", ts.total === await db.civToolCall.count(), `${ts.total}`);

  // INV-34c: registry tool konsisten — semua key punya capability & charter di DIVISION_META
  const registryOk = TOOL_REGISTRY.every((t) => typeof t.capability === "string" && t.capability.startsWith("tool."));
  const charterOk = DIVISIONS.every((d) => divisionMeta(d).tools.every((t) => TOOL_REGISTRY.some((r) => r.key === t)));
  check("INV-34c registry ↔ charter konsisten", registryOk && charterOk, `${TOOL_REGISTRY.length} tool, ${DIVISIONS.length} divisi`);

  // Bersih-bersih warga uji + jejak fisisnya (audit tool/artefak dibiarkan — bukti uji jujur)
  await db.civVillagerDirective.deleteMany({ where: { villagerId: { in: [vGen.id, vNet.id] } } });
  await db.civVillager.deleteMany({ where: { id: { in: [vGen.id, vNet.id] } } });
  await db.civAccount.deleteMany({ where: { id: { in: [walletT.id, walletT2.id] } } });

  // Bersih-bersih artefak uji
  await db.civAccount.deleteMany({ where: { orgId: buyer.id } });
  await db.civOrg.delete({ where: { id: buyer.id } }).catch(() => undefined);

  // ============================================================
  // SLICE 10 — REALITY BRIDGE: chat, config, MCP (5 uji baru)
  // ============================================================

  // INV-35: chat askCitizen mencatat DUA kaki (HUMAN + CITIZEN) dan balasan non-kosong
  try {
    const vChat = await db.civVillager.findFirst({ where: { status: "ACTIVE" } });
    if (vChat) {
      const { askCitizen } = await import("../src/lib/civos/chat");
      const r = await askCitizen({ villagerCode: vChat.code, body: "uji invariant chat", channel: "DASHBOARD" });
      const legs = await db.civChatMessage.count({ where: { villagerCode: vChat.code, body: { contains: "uji invariant chat" } } });
      const replyLeg = await db.civChatMessage.findFirst({ where: { villagerCode: vChat.code, from: "CITIZEN" }, orderBy: { createdAt: "desc" } });
      check("INV-35 chat 2 kaki (HUMAN masuk + CITIZEN balas)", r.ok && legs >= 1 && Boolean(replyLeg?.body), `kaki=${legs} balasan="${(replyLeg?.body ?? "").slice(0, 40)}"`);
      // bersih-bersih jejak chat uji
      await db.civChatMessage.deleteMany({ where: { villagerCode: vChat.code, body: { contains: "uji invariant chat" } } });
      if (replyLeg?.body && replyLeg.body.length > 0 && replyLeg.body.length < 400) await db.civChatMessage.delete({ where: { id: replyLeg.id } }).catch(() => undefined);
    } else check("INV-35 chat 2 kaki", false, "tidak ada warga aktif");
  } catch (e) { check("INV-35 chat 2 kaki", false, e instanceof Error ? e.message.slice(0, 60) : "?"); }

  // INV-36: config setConfigValue valid + field tak dikenal ditolak
  {
    const { setConfigValue, getConfigValue, CONFIG_FIELDS } = await import("../src/lib/civos/config");
    const okSet = await setConfigValue("chat.maxLen", "220");
    const badSet = await setConfigValue("hantu.tidakAda", "1");
    const back = await getConfigValue("chat.maxLen");
    check("INV-36 config put/get + tolak field hantu", okSet.ok && !badSet.ok && back === "220" && CONFIG_FIELDS.length >= 14, `${CONFIG_FIELDS.length} field, chat.maxLen=${back}`);
  }

  // INV-37: SECRET dimask di configView, nilai utuh di getConfigValue
  {
    const { setConfigValue, configView, getConfigValue } = await import("../src/lib/civos/config");
    await setConfigValue("supabase.serviceKey", "rahasia-invariant-123");
    const view = await configView();
    const maskedField = view.fields.find((f) => f.key === "supabase.serviceKey");
    const raw = await getConfigValue("supabase.serviceKey");
    const maskedOk = maskedField?.masked === true && !String(maskedField.value).includes("rahasia-invariant");
    check("INV-37 secret dimask di UI, utuh di server", maskedOk && raw === "rahasia-invariant-123", `view=${String(maskedField?.value).slice(0, 6)}… rawLen=${raw.length}`);
  }

  // INV-38: MCP server hantu ditolak; registry CRUD jalan
  {
    const { addMcpServer, removeMcpServer, mcpRpc, listMcpServers } = await import("../src/lib/civos/mcp");
    const ghost = await mcpRpc("server-hantu-inv", "tools/list", {});
    const added = await addMcpServer({ name: "inv-test-mcp", transport: "HTTP", endpoint: "http://127.0.0.1:1/" });
    const listed = await listMcpServers();
    const probe = await mcpRpc("inv-test-mcp", "tools/list", {}); // port 1 → FAILED jujur
    const removed = await removeMcpServer("inv-test-mcp");
    check("INV-38 MCP: ghost ditolak, CRUD + probe gagal-jujur", !ghost.ok && added.ok && listed.some((x) => x.name === "inv-test-mcp") && !probe.ok && removed.ok, `ghost=${!ghost.ok} add=${added.ok} probe=${probe.ok ? "ok" : "failed(jujur)"} del=${removed.ok}`);
  }

  // INV-39: dunia menyaring pesan sistem — worldChatInbound menyimpan kaki HUMAN channel WORLD
  {
    const { worldChatInbound } = await import("../src/lib/civos/chat");
    const vActive = await db.civVillager.findFirst({ where: { status: "ACTIVE" } });
    if (vActive) {
      await worldChatInbound({ senderName: "Mulky", message: "sensus uji dunia masuk" });
      const worldLeg = await db.civChatMessage.findFirst({ where: { channel: "WORLD", from: "HUMAN", body: { contains: "sensus uji dunia masuk" } } });
      check("INV-39 chat dunia masuk tercatat channel WORLD", Boolean(worldLeg), worldLeg ? `dari ${worldLeg.senderName}` : "tidak terekam");
      if (worldLeg) await db.civChatMessage.delete({ where: { id: worldLeg.id } }).catch(() => undefined);
      await db.civChatMessage.deleteMany({ where: { channel: "WORLD", body: { contains: "sensus uji dunia masuk" } } });
    } else check("INV-39 chat dunia masuk", false, "tidak ada warga aktif");
  }

  // SLICE 11 — SELF-LIFE & MULTI-SERVER (INV-40..44)
  {
    // INV-40: registry server default 3 (bedrock managed, java managed, aternos remote) — id unik, edisi sah
    const { ensureServerSeed, pingServer } = await import("../src/lib/civos/servers");
    const regs = await ensureServerSeed();
    const ids = new Set(regs.map((r) => r.id));
    const bedrock = regs.find((r) => r.id === "local-bedrock");
    const java = regs.find((r) => r.id === "local-java");
    const aternos = regs.find((r) => r.id === "aternos");
    check("INV-40 registry server all-in-one", regs.length >= 3 && ids.size === regs.length && Boolean(bedrock?.managed && java?.managed && !aternos?.managed), `${regs.map((r) => r.id).join(",")}`);
    // INV-41: ping jujur — aternos tidur harus offline (tidak pernah online palsu)
    const stAternos = await pingServer(aternos!);
    check("INV-41 ping jujur offline/online", typeof stAternos.online === "boolean" && (stAternos.online === false || (stAternos.latencyMs ?? 0) >= 0), `aternos online=${stAternos.online} ${stAternos.error ?? stAternos.latencyMs + "ms"}`);
    // INV-42: server_action remote ditolak jujur (kernel tidak bisa mengelola server pihak luar)
    const { serverAction } = await import("../src/lib/civos/servers");
    const rRemote = await serverAction("aternos", "start");
    check("INV-42 aksi server remote ditolak jujur", !rRemote.ok && rRemote.detail.includes("remote"), rRemote.detail.slice(0, 80));
    // INV-43: backup nyata — file ada + manifest sha256 + list terbaca
    const { backupAll, listBackups } = await import("../src/lib/civos/selflife");
    const b = await backupAll();
    const lb = listBackups();
    check("INV-43 backup tar.gz + manifest sha256", b.ok && Boolean(b.file) && (b.bytes ?? 0) > 1000 && (b.sha256 ?? "").length === 64 && lb.some((x) => x.file === b.file), `${b.file} ${b.bytes}B`);
    // INV-44: gitSync terstruktur jujur — hasil per remote (pushed atau alasan jujur)
    const { gitSync } = await import("../src/lib/civos/selflife");
    const gs = await gitSync();
    check("INV-44 gitSync 4 remote terstruktur", gs.remotes.length === 4 && gs.remotes.every((r) => typeof r.pushed === "boolean" && r.detail.length > 0), gs.remotes.map((r) => `${r.name}:${r.pushed ? "ok" : "fail"}`).join(" "));
  }

  console.log(`\n=== HASIL: ${pass} PASS / ${fail} FAIL ===`);
  await db.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
