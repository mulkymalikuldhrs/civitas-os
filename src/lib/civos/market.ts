// CIVITAS OS — market.ts
// SLICE 8: PASAR DESA — listing barang/layanan perusahaan, dikonsumsi warga.
// Matching DETERMINISTIK di kernel (termurah dulu, FIFO untuk harga sama) —
// pasaran bukan keputusan LLM (Intelligence ≠ Authority).
// Setiap perdagangan = TRADE_INTERNAL di ledger yang sama dengan bangsa,
// meta.classification = INTERNAL — BUKAN revenue eksternal (honesty gate tetap).
// Konservasi: qtySold + qtyAvailable === qtyInitial (INV-26).

import { db } from "@/lib/db";
import { emit } from "./events";
import { accountBalance, postTx } from "./ledger";
import { getPolicy } from "./policy";
import { fmt } from "./money";
import { EVENT_TYPES, KV_MARKET_SEQ } from "./types";

export interface MarketOfferRow {
  id: string;
  seller: string;
  item: string;
  unitPrice: number;
  unitPriceLabel: string;
  qtyAvailable: number;
  qtySold: number;
  status: string;
  createdAt: string;
}

/** Perusahaan memasarkan hasil produksi (dipanggil dari PRODUCE atau aksi admin). */
export async function listOffer(
  sellerOrgId: string,
  item: string,
  unitPrice: number,
  qty: number,
): Promise<{ ok: boolean; id?: string; note: string }> {
  const org = await db.civOrg.findUnique({ where: { id: sellerOrgId } });
  if (!org || org.kind !== "COMPANY") return { ok: false, note: "hanya COMPANY boleh listing di pasar desa" };
  if (["BANKRUPT", "DISSOLVED", "LIQUIDATING"].includes(org.lifecycle)) return { ok: false, note: `perusahaan ${org.lifecycle} tak boleh berjualan` };

  const name = item.trim().slice(0, 80);
  if (!name) return { ok: false, note: "nama barang wajib" };
  const cap = (await getPolicy<number>("MARKET_UNIT_PRICE_CAP")) ?? 250;
  if (!Number.isInteger(unitPrice) || unitPrice <= 0 || unitPrice > cap) return { ok: false, note: `harga satuan wajib integer 1..${cap} minor (di luar LLM)` };
  if (!Number.isInteger(qty) || qty < 1 || qty > 64) return { ok: false, note: "qty wajib integer 1..64" };

  const maxOpen = (await getPolicy<number>("MARKET_MAX_OFFERS_PER_ORG")) ?? 6;
  const open = await db.civMarketOffer.count({ where: { sellerOrgId, status: "OPEN" } });
  if (open >= maxOpen) return { ok: false, note: `limit listing OPEN terlampaui (${open}/${maxOpen})` };

  const offer = await db.civMarketOffer.create({
    data: { sellerOrgId, item: name, unitPrice, qtyInitial: qty, qtyAvailable: qty, status: "OPEN" },
  });
  await emit({
    type: EVENT_TYPES.MARKET_LISTED,
    subjectType: "MARKET",
    subjectId: offer.id,
    payload: { penjual: org.code, barang: name, harga: unitPrice, qty },
  });
  return { ok: true, id: offer.id, note: `${name} terlisting @${fmt(unitPrice)} ×${qty} oleh ${org.code}` };
}

/** Daftar penawaran OPEN (termurah dulu, FIFO) untuk UI & pembeli. */
export async function openOffers(take = 12): Promise<MarketOfferRow[]> {
  const rows = await db.civMarketOffer.findMany({
    where: { status: "OPEN" },
    include: { seller: true },
    orderBy: [{ unitPrice: "asc" }, { createdAt: "asc" }],
    take: Math.min(take, 24),
  });
  return rows.map((o) => ({
    id: o.id,
    seller: o.seller.code,
    item: o.item,
    unitPrice: o.unitPrice,
    unitPriceLabel: fmt(o.unitPrice),
    qtyAvailable: o.qtyAvailable,
    qtySold: o.qtySold,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
  }));
}

export interface MarketBuyResult {
  ok: boolean;
  note: string;
  ledger?: string | null;
  offerId?: string;
  units?: number;
  amount?: number;
}

/** Warga membeli dari pasar: ambil penawaran TERMAHKAH? tidak — TERMURAH (deterministik).
 *  Nominal ditetapkan KERNEL (harga × unit, di-clamp policy & saldo) — usulan LLM tak berlaku. */
export async function buyFromMarket(
  villager: { id: string; code: string; name: string; walletId: string },
  proposedUnits: number,
): Promise<MarketBuyResult> {
  const maxTx = (await getPolicy<number>("VILLAGER_MAX_TX")) ?? 250;
  const dailyCap = (await getPolicy<number>("VILLAGER_DAILY_SPEND")) ?? 1_000;

  const saldo = await accountBalance(villager.walletId);
  if (saldo < 1) return { ok: false, note: `dompet kosong (${fmt(saldo)}) — belanja ditunda` };

  // Pilih penawaran termurah yang terjangkau (deterministik: harga lalu FIFO).
  const offers = await db.civMarketOffer.findMany({
    where: { status: "OPEN", qtyAvailable: { gt: 0 } },
    include: { seller: true },
    orderBy: [{ unitPrice: "asc" }, { createdAt: "asc" }],
    take: 12,
  });
  if (offers.length === 0) return { ok: false, note: "pasar kosong — tak ada listing OPEN (warga menunggu produksi)" };

  const budget = Math.min(saldo, maxTx);
  const offer = offers.find((o) => o.unitPrice <= budget);
  if (!offer) {
    return { ok: false, note: `harga termurah ${fmt(offers[0].unitPrice)} di luar jangkauan dompet ${fmt(saldo)} / limit ${fmt(maxTx)}` };
  }

  const maxUnitsByMoney = Math.floor(Math.min(saldo, maxTx) / offer.unitPrice);
  const units = Math.max(1, Math.min(
    Number.isFinite(proposedUnits) && proposedUnits > 0 ? Math.floor(proposedUnits) : 1,
    offer.qtyAvailable,
    maxUnitsByMoney,
  ));
  const amount = units * offer.unitPrice;

  // Batas harian warga (kernel, bukan LLM).
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const spentToday = (await db.civEntry.findMany({
    where: { accountId: villager.walletId, side: "CREDIT", createdAt: { gte: start }, tx: { txType: { in: ["TRADE_INTERNAL"] } } },
    select: { amount: true },
  })).reduce((s, r) => s + r.amount, 0);
  if (spentToday + amount > dailyCap) {
    return { ok: false, note: `batas harian terlampaui (${fmt(spentToday)}+${fmt(amount)} > ${fmt(dailyCap)}) — belanja ditunda` };
  }

  const income = await db.civAccount.findFirst({ where: { orgId: offer.sellerOrgId, kind: "INCOME" } });
  if (!income) return { ok: false, note: `akun pendapatan ${offer.seller.code} tak ada — belanja batal` };

  const seq = await nextMarketSeq();
  const tx = await postTx({
    idempotencyKey: `market-${villager.code}-${seq}`,
    txType: "TRADE_INTERNAL",
    purpose: `Pasar desa: ${villager.name} beli ${units}× ${offer.item} dari ${offer.seller.code}`,
    eventType: EVENT_TYPES.MARKET_TRADED,
    subjectType: "VILLAGER",
    subjectId: villager.code,
    meta: {
      villagerBuyer: villager.code,
      penjual: offer.seller.code,
      offerId: offer.id,
      barang: offer.item,
      unit: units,
      hargaSatuan: offer.unitPrice,
      classification: "INTERNAL — pasar desa, BUKAN revenue eksternal",
    },
    legs: [
      { accountId: income.id, side: "DEBIT", amount },
      { accountId: villager.walletId, side: "CREDIT", amount },
    ],
  });
  if (!tx.ok) return { ok: false, note: `belanja pasar gagal: ${tx.reason}` };

  // Kurangi stok — konservasi dijaga di sisi kernel (INV-26).
  await db.civMarketOffer.update({
    where: { id: offer.id },
    data: {
      qtyAvailable: { decrement: units },
      qtySold: { increment: units },
      status: offer.qtyAvailable - units <= 0 ? "CLOSED" : "OPEN",
    },
  });

  return {
    ok: true,
    note: `beli ${units}× ${offer.item} dari ${offer.seller.code} @${fmt(offer.unitPrice)} — total ${fmt(amount)} (pasar internal)`,
    ledger: tx.txId ?? null,
    offerId: offer.id,
    units,
    amount,
  };
}

async function nextMarketSeq(): Promise<number> {
  const row = await db.civKV.findUnique({ where: { key: KV_MARKET_SEQ } });
  const n = (row ? Number(row.value) || 0 : 0) + 1;
  await db.civKV.upsert({ where: { key: KV_MARKET_SEQ }, create: { key: KV_MARKET_SEQ, value: String(n) }, update: { value: String(n) } });
  return n;
}

/** Statistik pasar untuk state/UI. */
export async function marketStats() {
  const [open, closed, totalUnitsSold] = await Promise.all([
    db.civMarketOffer.count({ where: { status: "OPEN" } }),
    db.civMarketOffer.count({ where: { status: "CLOSED" } }),
    db.civMarketOffer.aggregate({ _sum: { qtySold: true } }),
  ]);
  return { open, closed, totalUnitsSold: totalUnitsSold._sum.qtySold ?? 0 };
}
