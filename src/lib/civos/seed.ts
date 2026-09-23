// CIVITAS OS — seed.ts
// Bootstrap peradaban (PRD §4 MVP). IDEMPOTEN: aman dipanggil berkali-kali.
// Perusahaan lahir sebagai PROPOSED → pemerintah yang meregistrasinya lewat pipeline (bukti hidup).

import { db } from "@/lib/db";
import { emit } from "./events";
import { seedPolicies, seedCapabilities, grant } from "./policy";
import { mint } from "./ledger";
import { writeMemory } from "./memory";
import { EVENT_TYPES } from "./types";
import { getAccount } from "./accounts";

export interface SeedResult {
  seeded: boolean;
  detail: string;
}

export async function ensureSeed(): Promise<SeedResult> {
  // Kebijakan & capability SELALU diselaraskan (idempoten) — kebijakan baru terserap tanpa reset.
  await seedPolicies();
  await seedCapabilities();

  const existing = await db.civOrg.findUnique({ where: { code: "NUSANTARA" } });
  if (existing) return { seeded: false, detail: "peradaban sudah berdiri" };

  // ---------- NATION ----------
  const nation = await db.civOrg.create({
    data: {
      code: "NUSANTARA",
      kind: "NATION",
      name: "Nusantara Digital",
      lifecycle: "ACTIVE",
      specialization: "Peradaban otonom digital",
      meta: JSON.stringify({ visi: "peradaban yang hidup tanpa perintah manusia" }),
    },
  });
  const treasury = await db.civAccount.create({ data: { orgId: nation.id, kind: "TREASURY", name: "Kas Bangsa" } });
  const equity = await db.civAccount.create({ data: { orgId: nation.id, kind: "EQUITY", name: "Modal Peradaban" } });
  await db.civAccount.create({ data: { orgId: nation.id, kind: "EQUITY", name: "Modal Pelanggan Eksternal" } });

  const mintRes = await mint(treasury.id, equity.id, 100_000_000, "Pencetakan modal awal peradaban (1.000.000,00 FLR) — satu-satunya MINT", `mint-founding-${Date.now()}`);
  if (!mintRes.ok) return { seeded: false, detail: `MINT gagal: ${mintRes.reason}` };

  await emit({ type: EVENT_TYPES.NATION_FOUNDED, subjectType: "NATION", subjectId: nation.id, payload: { kode: "NUSANTARA", mintTx: mintRes.txId } });
  await writeMemory({
    ownerId: nation.id,
    ownerType: "ORG",
    scope: "INSTITUTIONAL",
    visibility: "PUBLIC",
    content: "Nusantara Digital didirikan. Modal awal dicetak via MINT tunggal. Hukum: uang hanya dari MINT; internal ≠ eksternal; failure = state valid.",
    provenance: { source: "seed", mint: mintRes.txId },
  });

  // ---------- GOVERNMENT ----------
  const gov = await db.civOrg.create({
    data: {
      code: "GOV",
      kind: "GOVERNMENT",
      name: "Pemerintah Nusantara",
      lifecycle: "ACTIVE",
      specialization: "Eksekutif · Bendahari · Regulator · Pajak",
    },
  });
  const govOps = await db.civAccount.create({ data: { orgId: gov.id, kind: "OPERATING", name: "Kas Pemerintah" } });
  await db.civAccount.create({ data: { orgId: gov.id, kind: "TAX", name: "Kas Pajak" } });
  await db.civAccount.create({ data: { orgId: gov.id, kind: "EXPENSE", name: "Beban Pemerintah" } });

  const govAgents = [
    { code: "GOV-GUB-001", name: "Gubernur Nusantara", role: "EXECUTIVE", authority: { pengadaan: true, keputusan: true } },
    { code: "GOV-TRE-001", name: "Bendahara Negara", role: "TREASURY", authority: { alokasiModal: true } },
    { code: "GOV-REG-001", name: "Registrar Perusahaan", role: "REGULATORY", authority: { registrasi: true } },
    { code: "GOV-TAX-001", name: "Otoritas Pajak", role: "TAX", authority: { pajakEksternal: true } },
  ];
  for (const a of govAgents) {
    const ag = await db.civAgent.create({
      data: { code: a.code, name: a.name, role: a.role, orgId: gov.id, authority: JSON.stringify(a.authority), budgetCap: 100_000, reputation: 55 },
    });
    await emit({ type: EVENT_TYPES.AGENT_CREATED, subjectType: "AGENT", subjectId: ag.id, payload: { kode: a.code, org: "GOV", peran: a.role } });
  }
  const gub = await db.civAgent.findUnique({ where: { code: "GOV-GUB-001" } });
  const tre = await db.civAgent.findUnique({ where: { code: "GOV-TRE-001" } });
  const reg = await db.civAgent.findUnique({ where: { code: "GOV-REG-001" } });
  const tax = await db.civAgent.findUnique({ where: { code: "GOV-TAX-001" } });
  if (gub) await grant(gub.id, "ledger.post", 100_000);
  if (tre) { await grant(tre.id, "treasury.allocate", 100_000); await grant(tre.id, "ledger.post", 100_000); }
  if (reg) await grant(reg.id, "company.register", 0);
  if (tax) await grant(tax.id, "tax.assess", 0);
  for (const a of [gub, tre, reg, tax]) if (a) await grant(a.id, "memory.write", 0);
  await emit({ type: EVENT_TYPES.GOVERNMENT_FORMED, subjectType: "GOVERNMENT", subjectId: gov.id, payload: { institusi: govAgents.map((a) => a.role) } });

  // ---------- CITY ----------
  const city = await db.civOrg.create({
    data: {
      code: "KOTA-01",
      kind: "CITY",
      name: "Kota Nusantara",
      lifecycle: "ACTIVE",
      specialization: "Pusat administrasi & pasar",
    },
  });
  await db.civAccount.create({ data: { orgId: city.id, kind: "TREASURY", name: "Kas Kota" } });
  const mayor = await db.civAgent.create({
    data: { code: "CTY-MAY-001", name: "Wali Kota Nusantara", role: "MAYOR", orgId: city.id, authority: JSON.stringify({ pemeliharaan: true }), budgetCap: 50_000 },
  });
  await grant(mayor.id, "memory.write", 0);
  await emit({ type: EVENT_TYPES.CITY_FOUNDED, subjectType: "CITY", subjectId: city.id, payload: { kode: "KOTA-01" } });

  // ---------- COMPANIES (PROPOSED — menunggu REGULATORY) ----------
  const companies = [
    { code: "COMP-001", name: "Penerjemah Nusantara", spec: "Jasa terjemahan & konten digital" },
    { code: "COMP-002", name: "Studio Data Kanvas", spec: "Produk data & visualisasi" },
    { code: "COMP-003", name: "Kopi Kode", spec: "Otomasi & alat kerja" },
  ];
  for (const c of companies) {
    const org = await db.civOrg.create({
      data: { code: c.code, kind: "COMPANY", name: c.name, lifecycle: "PROPOSED", specialization: c.spec, parentOrgId: nation.id },
    });
    await db.civAccount.create({ data: { orgId: org.id, kind: "OPERATING", name: `Kas Operasional ${c.code}` } });
    await db.civAccount.create({ data: { orgId: org.id, kind: "INCOME", name: `Pendapatan ${c.code}` } });
    await db.civAccount.create({ data: { orgId: org.id, kind: "EXPENSE", name: `Beban ${c.code}` } });
    const ceo = await db.civAgent.create({
      data: { code: `CEO-${c.code.slice(-3)}`, name: `Kepala ${c.name}`, role: "CEO", orgId: org.id, authority: JSON.stringify({ produksi: true, invoice: true }), budgetCap: 100_000 },
    });
    const opr = await db.civAgent.create({
      data: { code: `OPR-${c.code.slice(-3)}-1`, name: `Operator ${c.name}`, role: "OPERATOR", orgId: org.id, parentAgentId: ceo.id, authority: JSON.stringify({ produksi: true }), budgetCap: 50_000 },
    });
    await grant(ceo.id, "ledger.post", 50_000);
    await grant(ceo.id, "memory.write", 0);
    await grant(opr.id, "memory.write", 0);
    await emit({ type: EVENT_TYPES.COMPANY_PROPOSED, subjectType: "COMPANY", subjectId: org.id, payload: { kode: c.code, nama: c.name, spesialisasi: c.spec } });
    await emit({ type: EVENT_TYPES.AGENT_CREATED, subjectType: "AGENT", subjectId: ceo.id, payload: { kode: ceo.code, org: c.code } });
    await emit({ type: EVENT_TYPES.AGENT_CREATED, subjectType: "AGENT", subjectId: opr.id, payload: { kode: opr.code, org: c.code } });
  }

  // ---------- WORLD ENTITIES (Minecraft mapping; koordinat = rencana grid kanvas) ----------
  const entities = [
    { mcType: "DISTRICT", mcName: "Ibu Kota Nusantara", coords: { x: 0, z: 0 }, civType: "CITY", civCode: "KOTA-01" },
    { mcType: "BUILDING", mcName: "Istana Pemerintahan", coords: { x: -24, z: -18 }, civType: "GOVERNMENT", civCode: "GOV" },
    { mcType: "STRUCTURE", mcName: "Menara Kas Bangsa", coords: { x: -24, z: -4 }, civType: "NATION", civCode: "NUSANTARA" },
    { mcType: "BUILDING", mcName: "Kantor Penerjemah Nusantara", coords: { x: -8, z: 10 }, civType: "COMPANY", civCode: "COMP-001" },
    { mcType: "BUILDING", mcName: "Kantor Studio Data Kanvas", coords: { x: 8, z: 10 }, civType: "COMPANY", civCode: "COMP-002" },
    { mcType: "BUILDING", mcName: "Kantor Kopi Kode", coords: { x: 24, z: 10 }, civType: "COMPANY", civCode: "COMP-003" },
    { mcType: "STRUCTURE", mcName: "Pasar Nusantara", coords: { x: 0, z: 22 }, civType: "CITY", civCode: "KOTA-01" },
  ];
  for (const e of entities) {
    const org = await db.civOrg.findUnique({ where: { code: e.civCode } });
    if (!org) continue;
    await db.civWorldEntity.create({
      data: { mcType: e.mcType, mcName: e.mcName, mcCoords: JSON.stringify(e.coords), civType: e.civType, civId: org.id, civCode: e.civCode, status: "PLANNED" },
    });
  }

  await writeMemory({
    ownerId: city.id,
    ownerType: "ORG",
    scope: "ORGANIZATIONAL",
    content: "Tata kota: istana di barat laut, tiga kantor perusahaan di jalan utama selatan, pasar di tenggara. Menunggu sinkronisasi dunia Minecraft.",
    provenance: { source: "seed" },
  });

  void govOps; void tax; // akun/agen dirujuk via lookup di runtime
  return { seeded: true, detail: "Nusantara Digital berdiri: 1 bangsa, 1 pemerintah (4 institusi), 1 kota, 3 perusahaan PROPOSED, 11 agen" };
}

/** Hitung agen (untuk verifikasi seed). */
export async function agentCount(): Promise<number> {
  return db.civAgent.count();
}

export { getAccount };
