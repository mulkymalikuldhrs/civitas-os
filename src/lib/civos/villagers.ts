// CIVITAS OS — villagers.ts
// SLICE 7: VILLAGER ASCENSION — sensus warga desa.
// Setiap villager Minecraft naik derajat: dari NPC bodoh → AGEN OTONOM dengan
// identitas persisten (identity ≠ embodiment), dompet ledger pribadi, profesi →
// peran ekonomi, memori scoped, dan otak via LLM Router.
//
// Dua pintu sensus (dua-duanya JUJUR):
//  - createCensus(source="SIMULASI") : populasi uji berlabel, hidup saat server
//    Minecraft tidur — supaya pipeline desa terbukti bekerja end-to-end.
//  - observeVillagers(...)           : sensus NYATA dari packet AddEntityActor
//    dunia Minecraft (via mcbot). Sensus nyata MENGUNDURKAN diri warga SIMULASI.
//
// Profesi dibaca dari metadata entitas (VILLAGER_DATA) — tidak pernah dikarang.

import { db } from "@/lib/db";
import { emit } from "./events";
import { writeMemory } from "./memory";
import { getPolicy } from "./policy";
import { EVENT_TYPES, KV_VILLAGE_SEQ, divisionMeta } from "./types";

// ---------- Nama & profesi (deterministik, audit-able) ----------

const FIRST_NAMES = [
  "Aji", "Bayu", "Citra", "Dewi", "Jaka", "Kartika", "Lestari", "Made",
  "Ningsih", "Putra", "Ratna", "Sari", "Teguh", "Umar", "Wulan", "Yanto",
  "Zahra", "Bagas", "Melati", "Rangga", "Sri", "Bima", "Laras", "Gilang",
];
const FAMILY_NAMES = [
  "Wijaya", "Santoso", "Halim", "Kusuma", "Nagara", "Prawira", "Sanjaya", "Merdika",
];

/** Profesi villager Bedrock (VILLAGER_DATA.profession, 1.16+) → label & peran ekonomi. */
export const PROFESSION_INT_TO_KEY: Record<number, string> = {
  0: "unemployed", 1: "farmer", 2: "fisherman", 3: "shepherd", 4: "fletcher",
  5: "librarian", 6: "cartographer", 7: "cleric", 8: "armorer", 9: "weaponsmith",
  10: "toolsmith", 11: "butcher", 12: "leatherworker", 13: "mason", 14: "nitwit",
};

export const PROFESSION_MAP: Record<string, { label: string; role: string }> = {
  farmer: { label: "Petani", role: "PRODUCER" },
  fisherman: { label: "Nelayan", role: "PRODUCER" },
  shepherd: { label: "Gembala", role: "PRODUCER" },
  fletcher: { label: "Pandai Anak Panah", role: "CRAFT" },
  librarian: { label: "Pustakawan", role: "SCHOLAR" },
  cartographer: { label: "Kartografer", role: "SCHOLAR" },
  cleric: { label: "Klerik", role: "SPIRIT" },
  armorer: { label: "Penempa Zirah", role: "CRAFT" },
  weaponsmith: { label: "Penempa Senjata", role: "CRAFT" },
  toolsmith: { label: "Penempa Peralatan", role: "CRAFT" },
  butcher: { label: "Jagalan", role: "TRADE" },
  leatherworker: { label: "Pengolah Kulit", role: "CRAFT" },
  mason: { label: "Tukang Batu", role: "CRAFT" },
  nitwit: { label: "Filosof", role: "PHILOSOPHER" },
  unemployed: { label: "Calon Pekerja", role: "SEEKER" },
  unknown: { label: "Warga", role: "SEEKER" },
};

export function profMeta(key: string): { label: string; role: string } {
  return PROFESSION_MAP[key] ?? PROFESSION_MAP.unknown;
}

/** Rotasi profesi sensus simulasi — desa yang sehat butuh keragaman peran. */
const SIM_PROF_CYCLE = ["farmer", "librarian", "mason", "armorer", "toolsmith", "cartographer", "weaponsmith", "nitwit"];

// SLICE 9 — GUILD: rotasi divisi spesialis (8 guild inti, mandat pemilik).
// Sensus 8 pertama menjamin SATU warga per guild; lanjutan berputar kembali.
export const SPECIALIST_DIVISION_CYCLE = ["CODER", "DEV", "BUILDER", "MILITARY", "ENGINEER", "MINER", "NETRUNNER", "TOOLSMITH"] as const;

/** Peta profesi dunia nyata → guild (heuristik kernel, jujur; sisanya GENERAL). */
const PROFESSION_DIVISION: Record<string, string> = {
  librarian: "CODER",
  cartographer: "DEV",
  mason: "BUILDER",
  fletcher: "BUILDER",
  armorer: "MILITARY",
  weaponsmith: "MILITARY",
  toolsmith: "ENGINEER",
  farmer: "ENGINEER",
  fisherman: "NETRUNNER", // penjaring — metafora jaring internet
  shepherd: "MILITARY",
  cleric: "GENERAL",
  butcher: "GENERAL",
  leatherworker: "GENERAL",
  nitwit: "GENERAL",
  unemployed: "GENERAL",
  unknown: "GENERAL",
};

export function divisionForProfession(profession: string): string {
  return PROFESSION_DIVISION[profession] ?? "GENERAL";
}

// ---------- Util ----------

export async function nextSeq(): Promise<number> {
  const row = await db.civKV.findUnique({ where: { key: KV_VILLAGE_SEQ } });
  const n = (row ? Number(row.value) || 0 : 0) + 1;
  await db.civKV.upsert({ where: { key: KV_VILLAGE_SEQ }, create: { key: KV_VILLAGE_SEQ, value: String(n) }, update: { value: String(n) } });
  return n;
}

function pickName(totalIdx: number): string {
  const f = FIRST_NAMES[totalIdx % FIRST_NAMES.length];
  const s = FAMILY_NAMES[Math.floor(totalIdx / FIRST_NAMES.length) % FAMILY_NAMES.length];
  return `${f} ${s}`;
}

async function nextVillagerCode(): Promise<string> {
  const n = (await db.civVillager.count()) + 1;
  return `VIL-${String(n).padStart(4, "0")}`;
}

async function ensureWallet(code: string, name: string): Promise<string> {
  const existing = await db.civAccount.findFirst({ where: { kind: "WALLET", name: `Dompet ${code}` } });
  if (existing) return existing.id;
  const acc = await db.civAccount.create({ data: { kind: "WALLET", name: `Dompet ${code}`, currency: "FLR" } });
  void name;
  return acc.id;
}

// ---------- Observasi dunia nyata (packet MC) ----------

export interface McVillagerObs {
  entityUid: string;
  entityType: string;
  pos?: { x: number; y: number; z: number };
  profession: string; // kunci profesi terpeta
  rawMeta?: string; // bukti mentah (truncated) untuk audit
}

const VILLAGER_TYPE_RE = /^minecraft:villager(_v2)?$/i;

/** Parser MURNI packet AddEntityActor → observasi villager. Testable tanpa dunia.
 *  Defensif terhadap variasi nama field antar-versi protokol (entity_type|type, unique_id|runtime_id). */
export function parseVillagerEntity(p: unknown): McVillagerObs | null {
  if (!p || typeof p !== "object") return null;
  const q = p as {
    entity_type?: unknown; type?: unknown; unique_id?: unknown; runtime_id?: unknown;
    position?: { x?: unknown; y?: unknown; z?: unknown };
    metadata?: unknown;
  };
  const et = typeof q.entity_type === "string" ? q.entity_type : typeof q.type === "string" ? q.type : null;
  if (!et || !VILLAGER_TYPE_RE.test(et)) return null;
  const uid = q.unique_id !== undefined && q.unique_id !== null
    ? String(q.unique_id)
    : q.runtime_id !== undefined && q.runtime_id !== null
      ? `rt-${String(q.runtime_id)}`
      : null;
  if (!uid) return null;

  // Profesi: metadata entry dengan value ber-field `profession` (VILLAGER_DATA, key 17).
  let profession = "unknown";
  let rawMeta: string | undefined;
  if (Array.isArray(q.metadata)) {
    for (const m of q.metadata) {
      const v = (m as { value?: unknown } | null)?.value;
      if (v && typeof v === "object" && "profession" in (v as Record<string, unknown>)) {
        const pr = (v as Record<string, unknown>).profession;
        profession = typeof pr === "number" ? (PROFESSION_INT_TO_KEY[pr] ?? "unknown") : String(pr);
        rawMeta = JSON.stringify(m).slice(0, 240);
        break;
      }
    }
  }
  const pos = q.position && typeof q.position.x === "number" && typeof q.position.y === "number" && typeof q.position.z === "number"
    ? { x: q.position.x, y: q.position.y, z: q.position.z }
    : undefined;
  return { entityUid: uid, entityType: et, pos, profession, rawMeta };
}

// ---------- Sensus ----------

export interface CensusResult {
  source: string;
  created: { code: string; name: string; profession: string; profLabel: string; role: string }[];
  retired: number;
  cap: number;
  note: string;
}

/** Sensus desa — buat warga baru (SIM berlabel jujur, atau CENSUS nyata dari dunia). */
export async function createCensus(
  count: number,
  source: "SIMULASI" | "CENSUS",
  opts?: { professions?: string[]; observations?: McVillagerObs[] },
): Promise<CensusResult> {
  const cap = (await getPolicy<number>("VILLAGE_POPULATION_CAP")) ?? 24;
  const active = await db.civVillager.count({ where: { status: "ACTIVE" } });
  const room = Math.max(0, cap - active);
  const n = Math.min(Math.max(0, Math.floor(count)), room);
  const created: CensusResult["created"] = [];

  const workOrgs = await db.civOrg.findMany({
    where: { kind: "COMPANY", lifecycle: { notIn: ["BANKRUPT", "DISSOLVED"] } },
    orderBy: { code: "asc" },
    select: { id: true, code: true },
  });
  const totalBefore = await db.civVillager.count();

  for (let i = 0; i < n; i++) {
    const idx = totalBefore + i;
    const profKey = opts?.professions?.[i] ?? SIM_PROF_CYCLE[idx % SIM_PROF_CYCLE.length];
    const meta = profMeta(profKey);
    // SLICE 9 — divisi guild: SIM berputar guild spesialis; CENSUS memetakan profesi dunia.
    const division = source === "CENSUS" ? divisionForProfession(profKey) : SPECIALIST_DIVISION_CYCLE[idx % SPECIALIST_DIVISION_CYCLE.length];
    const divMeta = divisionMeta(division);
    const code = await nextVillagerCode();
    const name = pickName(idx);
    const obs = opts?.observations?.[i];
    const walletId = await ensureWallet(code, name);
    const v = await db.civVillager.create({
      data: {
        code, name, profession: profKey, profLabel: meta.label, role: meta.role,
        division,
        source, walletId,
        mcEntityUid: obs?.entityUid ?? null,
        mcCoords: obs?.pos ? JSON.stringify(obs.pos) : "{}",
        embodiment: obs ? "EMBODIED" : "DREAMING",
        workOrgId: workOrgs.length > 0 ? workOrgs[idx % workOrgs.length].id : null,
      },
    });
    created.push({ code: v.code, name: v.name, profession: v.profession, profLabel: v.profLabel, role: v.role });
    await emit({
      type: EVENT_TYPES.VILLAGER_ASCENDED,
      subjectType: "VILLAGER",
      subjectId: v.code,
      payload: { nama: v.name, profesi: v.profLabel, peran: v.role, divisi: division, guild: divMeta.label, charterTool: divMeta.tools, sumber: source, tubuh: v.embodiment, dompet: walletId },
    });
    await writeMemory({
      ownerId: v.id, ownerType: "AGENT", scope: "EPISODIC", visibility: "PRIVATE",
      content: `Aku lahir: dulu villager biasa, kini agen otonom ${v.code} (${v.name}), ${v.profLabel}. Aku masuk GUILD ${division} (${divMeta.desc})${divMeta.tools.length > 0 ? ` dengan charter tool: ${divMeta.tools.join(", ")}` : ""}. Dompetku dibuka di ledger peradaban. Sensus: ${source}.`,
      provenance: { source: "villagers.census", sensus: source, divisi: division },
    });
  }

  const retired = source === "CENSUS" ? await retireSimVillagers() : 0;
  await emit({
    type: EVENT_TYPES.VILLAGE_CENSUS,
    subjectType: "VILLAGE",
    subjectId: "Desa Nusantara",
    payload: { sumber: source, lahir: created.length, mundur_sim: retired, populasi: active + created.length, cap },
  });
  const note = created.length === 0
    ? `tidak ada slot — populasi ${active}/${cap}`
    : `${created.length} warga naik derajat (${source})${retired > 0 ? `; ${retired} warga SIMULASI mundur` : ""}`;
  return { source, created, retired, cap, note };
}

/** Sensus nyata masuk → warga SIMULASI mundur (bukan dihapus — sejarah tetap auditable). */
export async function retireSimVillagers(): Promise<number> {
  const sims = await db.civVillager.findMany({ where: { status: "ACTIVE", source: "SIMULASI" }, select: { id: true, code: true, name: true } });
  if (sims.length === 0) return 0;
  const r = await db.civVillager.updateMany({ where: { id: { in: sims.map((s) => s.id) } }, data: { status: "RETIRED", embodiment: "MISSING" } });
  for (const s of sims) {
    await emit({ type: EVENT_TYPES.VILLAGER_RETIRED, subjectType: "VILLAGER", subjectId: s.code, payload: { alasan: "digantikan sensus NYATA dari dunia Minecraft" } });
  }
  return r.count;
}

/** Sinkron warga dari observasi dunia nyata: bind/re-bind tubuh + update koordinat. */
export async function observeVillagers(obs: McVillagerObs[]): Promise<{ embodied: number; bound: number; note: string }> {
  let embodied = 0;
  let bound = 0;
  for (const o of obs) {
    const existing = await db.civVillager.findUnique({ where: { mcEntityUid: o.entityUid } });
    if (existing) {
      await db.civVillager.update({
        where: { id: existing.id },
        data: { embodiment: "EMBODIED", mcCoords: o.pos ? JSON.stringify(o.pos) : existing.mcCoords, lastActionAt: existing.lastActionAt },
      });
      embodied += 1;
    } else {
      // Tubuh baru tanpa identitas → identitas CENSUS baru lahir untuk tubuh itu.
      const created = await createCensus(1, "CENSUS", {
        professions: [o.profession],
        observations: [o],
      });
      bound += created.created.length;
    }
  }
  // Warga EMBODIED yang tak terlihat sesi ini → MISSING (tubuh hilang dari pandangan)
  const seenUids = new Set(obs.map((o) => o.entityUid));
  const staked = await db.civVillager.findMany({ where: { status: "ACTIVE", embodiment: "EMBODIED" }, select: { id: true, mcEntityUid: true } });
  for (const v of staked) {
    if (v.mcEntityUid && !seenUids.has(v.mcEntityUid)) {
      await db.civVillager.update({ where: { id: v.id }, data: { embodiment: "MISSING" } });
    }
  }
  return { embodied, bound, note: `${embodied} tubuh terkonfirmasi, ${bound} identitas baru, ${staked.length - embodied} missing` };
}

/** Statistik desa untuk state.ts / UI. */
export async function villageStats() {
  const all = await db.civVillager.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } });
  const byProfession: Record<string, number> = {};
  for (const v of all) byProfession[v.profLabel] = (byProfession[v.profLabel] ?? 0) + 1;
  const byDivision: Record<string, number> = {};
  for (const v of all) byDivision[v.division] = (byDivision[v.division] ?? 0) + 1;
  const bySource = { SIMULASI: all.filter((v) => v.source === "SIMULASI").length, CENSUS: all.filter((v) => v.source === "CENSUS").length };
  const byEmbodiment = { EMBODIED: all.filter((v) => v.embodiment === "EMBODIED").length, DREAMING: all.filter((v) => v.embodiment === "DREAMING").length, MISSING: all.filter((v) => v.embodiment === "MISSING").length };
  return {
    population: all.length,
    byProfession,
    byDivision,
    bySource,
    byEmbodiment,
    codes: all.map((v) => v.code),
  };
}
