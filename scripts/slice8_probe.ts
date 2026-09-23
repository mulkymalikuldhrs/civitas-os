// CIVITAS OS — probe Slice 8: alur pasar desa + direktif tubuh nyata (kernel langsung).
// Jalankan: bun scripts/slice8_probe.ts
import { db } from "../src/lib/db";
import { accountBalance } from "../src/lib/civos/ledger";
import { buyFromMarket, openOffers } from "../src/lib/civos/market";
import { enqueueDirective, claimDirectivesForBot, runSimDirectives } from "../src/lib/civos/directives";
import { fmt } from "../src/lib/civos/money";

async function main() {
  console.log("=== PROBE SLICE 8 — PASAR + TUBUH ===");

  // 1) Pasar: listing OPEN saat ini
  const offers = await openOffers(5);
  console.log(`listing OPEN: ${offers.length}`);
  for (const o of offers) console.log(`  - ${o.seller} | ${o.item} | ${o.unitPriceLabel} | sisa ${o.qtyAvailable}`);

  // 2) Warga berdompet membeli dari listing termurah (deterministik)
  const villagers = await db.civVillager.findMany({ where: { status: "ACTIVE", walletId: { not: null } }, orderBy: { code: "asc" } });
  let buyer: { id: string; code: string; name: string; walletId: string } | null = null;
  for (const v of villagers) {
    if (v.walletId && (await accountBalance(v.walletId)) >= 10) { buyer = { id: v.id, code: v.code, name: v.name, walletId: v.walletId }; break; }
  }
  if (!buyer) {
    console.log("tidak ada warga berdompet ≥0,10 FLR — buat listing lalu jalankan denyut WORK sampai upah masuk (jujur, dilewati)");
  } else {
    const before = await accountBalance(buyer.walletId);
    const r = await buyFromMarket(buyer, 1);
    const after = await accountBalance(buyer.walletId);
    console.log(`BELI PASAR: ${buyer.code} saldo ${fmt(before)} → ${fmt(after)} | ${r.note}${r.ledger ? ` | tx=${r.ledger}` : ""}`);
    if (r.ok) {
      const off = r.offerId ? await db.civMarketOffer.findUnique({ where: { id: r.offerId } }) : null;
      console.log(`  stok listing: terjual ${off?.qtySold}, sisa ${off?.qtyAvailable}, status ${off?.status}`);
    }
  }

  // 3) Klaim bot: direktif MOVE ber-anchor → perintah tp siap dunia
  const v = villagers[0];
  if (v) {
    await enqueueDirective({ id: v.id, code: v.code, name: v.name, mcCoords: JSON.stringify({ x: 100, y: 64, z: 100 }) }, "MOVE", { to: { x: 110, y: 64, z: 105 } });
    const claimed = await claimDirectivesForBot(3);
    for (const c of claimed) console.log(`KLAIM BOT: ${c.villagerCode} ${c.kind} ${c.command ?? c.chatMessage ?? ""}`);
    if (claimed.length === 0) {
      // dunia offline → antrean dikonsumsi SIM (mimpi jaga) sebelum klaim — jalankan sim dan laporkan
      const sim = await runSimDirectives(false);
      console.log(`SIM: ${sim.note}`);
    }
  }
  console.log("=== PROBE SELESAI ===");
  await db.$disconnect();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(2); });
