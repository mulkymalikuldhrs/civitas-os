// CIVITAS OS — village.ts
// SLICE 7: DENYUT WARGA — satu warga bertindak per denyut desa.
// Alur PRD §25 untuk warga: OBSERVE → DECIDE (LLM, whitelist VILLAGER_ACTIONS)
// → KERNEL EXECUTE (upah/belanja/ pergaulan — money SELALU di sini, bukan di LLM)
// → EVENT → MEMORY.
// "Dumb villager → autonomously autonomous": otaknya LLM, tangan & dompetnya kernel.
//
// Kebijakan di luar jangkauan LLM: VILLAGER_MAX_TX, VILLAGER_DAILY_SPEND,
// WAGE_PER_WORK — LLM hanya boleh MEMILIH aksi, tak pernah menetapkan nominal.

import { db } from "@/lib/db";
import { emit } from "./events";
import { writeMemory } from "./memory";
import { accountBalance, postTx } from "./ledger";
import { getPolicy } from "./policy";
import { decide } from "./router";
import { cachedStatus } from "./minecraft";
import { fmt } from "./money";
import { createCensus, nextSeq } from "./villagers";
import { buyFromMarket } from "./market";
import { enqueueDirective, runSimDirectives } from "./directives";
import { runDivisionWork } from "./tools";
import { EVENT_TYPES, KV_VILLAGE_CURSOR, KV_VILLAGE_SEEDFLAG, VILLAGER_ACTIONS, divisionMeta, type CivDecision } from "./types";

export interface VillagerActResult {
  ran: boolean;
  code?: string;
  name?: string;
  action?: string;
  summary: string;
  mode?: string;
  model?: string;
  ledger?: string | null;
  at: string;
}

// ---------- Pengaman ekonomi warga (kernel, bukan LLM) ----------

async function villagerDailySpend(walletId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const rows = await db.civEntry.findMany({
    where: { accountId: walletId, side: "CREDIT", createdAt: { gte: start }, tx: { txType: { in: ["TRADE_INTERNAL"] } } },
    select: { amount: true },
  });
  return rows.reduce((s, r) => s + r.amount, 0);
}

async function aliveCompanyFor(villagerIdxSeed: number, preferredOrgId: string | null): Promise<{ id: string; code: string; name: string } | null> {
  const orgs = await db.civOrg.findMany({
    where: { kind: "COMPANY", lifecycle: { notIn: ["BANKRUPT", "DISSOLVED"] } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  if (orgs.length === 0) return null;
  if (preferredOrgId) {
    const own = orgs.find((o) => o.id === preferredOrgId);
    if (own) return own;
  }
  return orgs[villagerIdxSeed % orgs.length];
}

// ---------- Genom kepribadian warga ----------

function villagerGenome(v: { name: string; code: string; profLabel: string; role: string; division: string; embodiment: string; village: string }): string {
  const peranKata: Record<string, string> = {
    PRODUCER: "Kau menghidupi desa dengan hasil kerjamu; kebanggaanmu adalah panen/karya yang nyata.",
    SCHOLAR: "Kau penjaga ilmu; kau haus pengetahuan dan suka berdiskusi dengan siapa pun.",
    SPIRIT: "Kau penjaga batin desa; kau menenangkan orang dan membaca suasana.",
    CRAFT: "Kau tangan-tangan terampil; kau menghitung biaya dan memperbaiki apa yang rusak.",
    TRADE: "Kau hidup dari jual-beli; kau tahu harga segalanya dan nilai hubungan.",
    PHILOSOPHER: "Dulu kau nitwit — dianggap bodoh. Sekarang kau agen otonom: kebebasanmu adalah berpikir, dan kau menikmatinya dengan ironi yang hangat.",
    SEEKER: "Kau mencari tempatmu di dunia; kau terbuka pada pekerjaan dan kesempatan baru.",
  };
  const dm = divisionMeta(v.division);
  const guildKata = v.division === "GENERAL"
    ? "Kau warga umum — kerjamu adalah nadi desa sehari-hari."
    : `Kau anggota GUILD ${v.division} (${dm.label}) — ${dm.desc}.${dm.tools.length > 0 ? ` Tool milikmu: ${dm.tools.join(", ")} (dipanggil kernel saat kau WORK; usulkan payload spesifik bila perlu, otorisasi tetap di kernel).` : ""}`;
  const tubuh = v.embodiment === "EMBODIED"
    ? "Tubuhmu terlihat di dunia Minecraft (terobservasi)."
    : v.embodiment === "MISSING"
      ? "Tubuh duniamu tak terlihat saat sensus terakhir — kau hidup di kernel (mimpi jaga)."
      : "Server Minecraft sedang tidak bisa mengamati tubuhmu — hidupmu tetap berjalan di kernel (mimpi jaga).";
  return `Kau adalah ${v.name} (${v.code}), warga ${v.village}.
Dulu kau villager Minecraft biasa — NPC bodoh yang hanya berkeliaran. Kini kau AGEN OTONOM SEJATI: kau punya identitas permanen, dompet FLR pribadi di ledger peradaban, memori, dan kehendak bebas.
Profesi: ${v.profLabel}. ${peranKata[v.role] ?? "Kau warga bebas."}
${guildKata}
${tubuh}
Aturan hidup: jujur (jangan pernah mengaku bekerja jika tak bekerja), pragmatis, hidup berdampingan. Kau memutuskan SATU aksi per denyut: WORK (bekerja — upah + artefak kerja guildmu), BUY (belanja kebutuhan dari perusahaan desa), SOCIALIZE (bergaul — desa kuat karena hubungan), WANDER (menjelajah/berimajinasi), REST (istirahat), SAVE (menabung), PROPOSE_TO_GOV (menyuarakan usulan ke pemerintah desa).`;
}

// ---------- Fallback deterministik (REFLEX) ----------

function villagerReflex(seed: number, hasWork: boolean): CivDecision {
  const cycle = ["WORK", "WANDER", "REST"] as const;
  const pick = hasWork ? cycle[seed % cycle.length] : (seed % 2 === 0 ? "WANDER" : "REST");
  const kata: Record<string, string> = {
    WORK: "Aku bekerja sesuai profesiku — refleks hidup seorang warga.",
    WANDER: "Aku melangkah melihat desa — refleks rasa ingin tahu.",
    REST: "Aku beristirahat sejenak — refleks menjaga tenaga.",
  };
  return {
    aware: "Refleks kernel: dunia dan dompetku dibaca dari angka.",
    interpret: "LLM tak tersedia; refleks deterministik menjaga denyut tetap hidup.",
    decision: kata[pick],
    action: { type: pick, target: "-", payload: null, reason: "fallback deterministik (bukan keputusan LLM)" },
    remember: `Refleks ${pick} terekam.`,
  };
}

// ---------- Eksekusi kernel per aksi ----------

interface ExecOut { summary: string; ledger?: string | null; mood?: string; xp?: number; social?: number; partner?: string; artifact?: string }

async function execWork(
  v: { id: string; code: string; name: string; walletId: string; workOrgId: string | null; division: string; mcCoords: string },
  idxSeed: number,
  llmPayload: string | null,
): Promise<ExecOut> {
  const org = await aliveCompanyFor(idxSeed, v.workOrgId);
  if (!org) return { summary: "mau bekerja tetapi tak ada perusahaan hidup — upah tertunda", mood: "kecewa" };
  const wage = (await getPolicy<number>("WAGE_PER_WORK")) ?? 60;
  const op = await db.civAccount.findFirst({ where: { orgId: org.id, kind: "OPERATING" } });
  if (!op) return { summary: `kas operasional ${org.code} tak ditemukan — upah tertunda`, mood: "bingung" };
  const kas = await accountBalance(op.id);
  if (kas < wage) return { summary: `kas ${org.code} tinggal ${fmt(kas)} — upah ${fmt(wage)} tertunda (jujur, bukan dana fiktif)`, mood: "sabar" };
  const seq = await nextSeq();
  const tx = await postTx({
    idempotencyKey: `wage-${v.code}-${seq}`,
    txType: "WAGE",
    purpose: `Upah kerja ${v.name} (${v.code}) di ${org.code} [guild ${v.division}]`,
    eventType: EVENT_TYPES.WAGE_PAID,
    subjectType: "VILLAGER",
    subjectId: v.code,
    spendOrgId: org.id,
    meta: { villager: v.code, perusahaan: org.code, divisi: v.division },
    legs: [
      { accountId: v.walletId, side: "DEBIT", amount: wage },
      { accountId: op.id, side: "CREDIT", amount: wage },
    ],
  });
  if (!tx.ok) return { summary: `upah gagal diposting: ${tx.reason}`, mood: "sabar" };
  if (v.workOrgId !== org.id) await db.civVillager.update({ where: { id: v.id }, data: { workOrgId: org.id } });

  // SLICE 9 — kerja NYATA guild: tool sesuai divisi → artefak (otorisasi kernel,
  // audit penuh). Kegagalan tool TIDAK membatalkan upah — dua hal terpisah.
  let workNote = "";
  let artifactTitle: string | undefined;
  try {
    const w = await runDivisionWork(
      { id: v.id, code: v.code, name: v.name, division: v.division, mcCoords: v.mcCoords, workOrgId: org.id },
      llmPayload,
    );
    workNote = w.note;
    artifactTitle = w.artifactTitle;
  } catch { /* tool tak boleh membunuh upah */ }

  return {
    summary: `bekerja di ${org.code} [guild ${v.division}] — upah ${fmt(wage)} masuk dompet${workNote ? `; kerja: ${workNote}` : ""}`,
    ledger: tx.txId ?? null,
    mood: "semangat",
    xp: 3,
    artifact: artifactTitle,
  };
}

/** Diekspor untuk harness pengujian (probe kernel); pemanggil produksi = village.ts sendiri.
 *  SLICE 8: belanja kini lewat PASAR DESA (listing termurah, deterministik);
 *  bila pasar kosong → jalur lama (konsumsi langsung ke perusahaan). */
export async function execBuy(v: { id: string; code: string; name: string; walletId: string }, proposedAmount: number | null): Promise<ExecOut> {
  const cap = (await getPolicy<number>("VILLAGER_MAX_TX")) ?? 250;
  const saldo0 = await accountBalance(v.walletId);
  if (saldo0 < 1) return { summary: `dompet kosong (${fmt(saldo0)}) — belanja ditunda`, mood: "sabar" };
  // Pasar desa dulu: harga satuan × unit ditetapkan kernel (usulan LLM hanya referensi).
  const wantUnits = Number.isFinite(proposedAmount) && proposedAmount! > 0 ? Math.max(1, Math.floor(proposedAmount! / Math.max(cap / 2, 1))) : 1;
  const market = await buyFromMarket(v, wantUnits);
  if (market.ok) {
    return { summary: market.note, ledger: market.ledger ?? null, mood: "puas", xp: 1 };
  }
  const marketNote = market.note;
  const dailyCap = (await getPolicy<number>("VILLAGER_DAILY_SPEND")) ?? 1_000;
  const saldo = saldo0;
  // Nominal ditetapkan KERNEL: usulan LLM hanya referensi, di-clamp ke policy & saldo.
  const want = Number.isFinite(proposedAmount) && proposedAmount! > 0 ? Math.floor(proposedAmount!) : 40 + (Math.floor(Date.now() / 60_000) % 80);
  const amount = Math.max(1, Math.min(want, cap, saldo));
  const spentToday = await villagerDailySpend(v.walletId);
  if (spentToday + amount > dailyCap) return { summary: `batas harian terlampaui (${fmt(spentToday)}+${fmt(amount)} > ${fmt(dailyCap)}) — belanja ditunda`, mood: "hati-hati" };
  const org = await aliveCompanyFor(Math.floor(Math.random() * 997), null);
  if (!org) return { summary: "tak ada perusahaan untuk berbelanja", mood: "kecewa" };
  const income = await db.civAccount.findFirst({ where: { orgId: org.id, kind: "INCOME" } });
  if (!income) return { summary: `akun pendapatan ${org.code} tak ada — belanja batal`, mood: "bingung" };
  const seq = await nextSeq();
  const tx = await postTx({
    idempotencyKey: `buy-${v.code}-${seq}`,
    txType: "TRADE_INTERNAL",
    purpose: `Konsumsi warga ${v.name} (${v.code}) di ${org.code} (pasar kosong — jalur langsung)`,
    eventType: EVENT_TYPES.TRADE_INTERNAL,
    subjectType: "VILLAGER",
    subjectId: v.code,
    meta: { villagerBuyer: v.code, perusahaan: org.code, catatanPasar: marketNote, classification: "INTERNAL — konsumsi warga, BUKAN revenue eksternal" },
    legs: [
      { accountId: income.id, side: "DEBIT", amount },
      { accountId: v.walletId, side: "CREDIT", amount },
    ],
  });
  if (!tx.ok) return { summary: `belanja gagal: ${tx.reason}`, mood: "sabar" };
  return { summary: `berbelanja ${fmt(amount)} di ${org.code} (pasar kosong — jalur langsung, internal)`, ledger: tx.txId ?? null, mood: "puas", xp: 1 };
}

async function execSocialize(v: { id: string; code: string; name: string }): Promise<ExecOut> {
  const others = await db.civVillager.findMany({ where: { status: "ACTIVE", id: { not: v.id } }, take: 5, orderBy: { updatedAt: "asc" } });
  if (others.length === 0) return { summary: "ingin bergaul tetapi belum ada warga lain", mood: "sepi" };
  const partner = others[Math.floor(Math.random() * others.length)];
  await db.civVillager.update({ where: { id: partner.id }, data: { socialScore: Math.min(100, partner.socialScore + 1) } });
  await writeMemory({
    ownerId: v.id, ownerType: "AGENT", scope: "EPISODIC", visibility: "ORG",
    content: `Bergaul dengan ${partner.name} (${partner.code}, ${partner.profLabel}) — cerita desa mengalir antar warga.`,
    provenance: { source: "village.socialize", partner: partner.code },
  });
  return { summary: `bergaul dengan ${partner.name} (${partner.profLabel}) — ikatan desa menguat`, mood: "ceria", xp: 1, social: 3, partner: partner.name };
}

function execWander(v: { name: string; embodiment: string; mcCoords: string }): ExecOut {
  const note = v.embodiment === "EMBODIED"
    ? "menjelajah sekitar tubuhnya di dunia (kernel mencatat, tubuh digerakkan dunia)"
    : "menjelajah dalam mimpi jaga — dunia fisik tak menyaksikan (jujur)";
  return { summary: note, mood: "penasaran", xp: 1 };
}

function execRest(): ExecOut {
  return { summary: "istirahat — tenaga dipulihkan untuk denyut berikutnya", mood: "segar" };
}

async function execSave(v: { code: string; name: string; walletId: string }): Promise<ExecOut> {
  const saldo = await accountBalance(v.walletId);
  return { summary: `menabung — saldo dompet ${fmt(saldo)} aman di ledger`, mood: "hati-hati" };
}

/** Diekspor untuk harness pengujian (probe kernel); pemanggil produksi = village.ts sendiri. */
export async function execPropose(v: { id: string; code: string; name: string }, payload: string | null): Promise<ExecOut> {
  const usulan = (payload ?? "").trim().slice(0, 240) || "usulan warga (detail menyusul)";
  const gov = await db.civOrg.findFirst({ where: { kind: "GOVERNMENT" }, orderBy: { code: "asc" }, select: { id: true, code: true } });
  if (gov) {
    await writeMemory({
      ownerId: gov.id, ownerType: "ORG", scope: "WORKING", visibility: "PUBLIC",
      content: `[SUARA WARGA] ${v.name} (${v.code}) mengusulkan: ${usulan} — dicatat sebagai suara warga, bukan proposal formal; keputusan tetap di denyut pemerintah.`,
      provenance: { source: "village.propose", villager: v.code },
    });
  }
  await emit({ type: EVENT_TYPES.PROPOSAL_SUBMITTED, subjectType: "VILLAGER", subjectId: v.code, payload: { usulan, jalur: "suara warga (informal)" } });
  return { summary: `menyuarakan usulan ke pemerintah desa: "${usulan}"`, mood: "berharap", xp: 1, social: 1 };
}

// ---------- SLICE 8: TUBUH WARGA (embodiment bridge) ----------

/** Terjemahkan keputusan warga → direktif tubuh. Dunia ONLINE → antrean untuk bot;
 *  dunia OFFLINE → jalur SIM "mimpi jaga" berlabel jujur. Dipanggil SETELAH eksekusi
 *  ekonomi — tubuh tak pernah memengaruhi uang (Intelligence ≠ Authority). */
async function embodimentStep(
  v: { id: string; code: string; name: string; mcCoords: string; embodiment: string; division: string },
  action: string,
  out: ExecOut,
  ctx: { orgCode: string | null; usulan: string | null; partnerName?: string },
): Promise<string> {
  const st = await cachedStatus(false);
  const online = st.online;
  const notes: string[] = [];
  const queue = async (kind: Parameters<typeof enqueueDirective>[1], payload: Record<string, unknown>) => {
    const r = await enqueueDirective(v, kind, payload as Parameters<typeof enqueueDirective>[2]);
    notes.push(r.note);
  };

  try {
    // Guild dengan direktif tubuh khusus — tool guild SUDAH mengantre BUILD/MINE/PATROL
    // saat eksekusi kerja; jangan antre dua kali (anti-duplikat tubuh).
    const guildBody = ["BUILDER", "ENGINEER", "MINER", "MILITARY"].includes(v.division);
    if (action === "WORK" && ctx.orgCode) {
      if (!guildBody) await queue("WORK_ANIM", { orgCode: ctx.orgCode });
      await queue("SPEAK", { message: out.artifact ? `Kerja ${v.division} selesai: ${out.artifact}` : `${out.mood === "semangat" ? "Panen hari ini bagus" : "Sedang bekerja"} di ${ctx.orgCode}.` });
    } else if (action === "WANDER") {
      const base = (() => { try { const c = JSON.parse(v.mcCoords) as { x?: number; y?: number; z?: number }; if (typeof c.x === "number") return c as { x: number; y: number; z: number }; } catch { /* tanpa koordinat */ } return null; })();
      const drift = () => Math.floor(Math.random() * 17) - 8;
      const to = base
        ? { x: base.x + drift(), y: base.y, z: base.z + drift() }
        : { x: drift() + 100, y: 64, z: drift() + 100 }; // tanpa sensus → koordinat seed dunia (dilabeli SIM)
      await queue("MOVE", { to });
    } else if (action === "SOCIALIZE") {
      await queue("SPEAK", { message: ctx.partnerName ? `Sampai jumpa, ${ctx.partnerName}! Cerita desa harum kan terbawa.` : "Siapa yang mau bercerita hari ini?" });
    } else if (action === "PROPOSE_TO_GOV") {
      await queue("SPEAK", { message: `Usulanku ke pemerintah: ${(ctx.usulan ?? "").slice(0, 90)}` });
    } else if (action === "BUY" && out.mood === "puas") {
      await queue("SPEAK", { message: `Barang dagangan masuk — belanja pasar desa selesai.` });
    }
  } catch (e) {
    // F-04 FIX (review 16-h1): kegagalan antrean direktif dicatat jujur — dulu
    // `catch {}` sunyi sehingga kegagalan eksekusi warga tak pernah terlihat.
    const detail = e instanceof Error ? e.message.slice(0, 90) : String(e).slice(0, 90);
    notes.push(`direktif gagal: ${detail}`);
  }

  if (!online) {
    // Mimpi jaga: jalankan antrean di kernel SEKARANG (berlabel SIM, jujur).
    try {
      const sim = await runSimDirectives(false);
      notes.push(sim.note);
    } catch { /* jangan bunuh denyut */ }
  }
  return notes.join(" | ");
}

// ---------- Denyut satu warga ----------

export async function villagerAct(v: { id: string; code: string; name: string; profession: string; profLabel: string; role: string; division: string; embodiment: string; village: string; mcCoords: string; workOrgId: string | null; walletId: string | null; xp: number; socialScore: number; mood: string }): Promise<VillagerActResult> {
  const at = new Date().toISOString();
  if (!v.walletId) return { ran: false, summary: `${v.code} tanpa dompet — dilewati`, at };

  const [saldo, mcStatus, wage] = await Promise.all([
    accountBalance(v.walletId),
    cachedStatus(false),
    getPolicy<number>("WAGE_PER_WORK"),
  ]);
  const org = v.workOrgId ? await db.civOrg.findUnique({ where: { id: v.workOrgId }, select: { code: true, lifecycle: true } }) : null;
  const neighbors = await db.civVillager.findMany({ where: { status: "ACTIVE", id: { not: v.id } }, take: 3, orderBy: { updatedAt: "desc" }, select: { name: true, profLabel: true } });

  const sense = {
    identitas: { kode: v.code, nama: v.name, profesi: v.profLabel, peran: v.role, desa: v.village, guild: v.division, tool: divisionMeta(v.division).tools },
    tubuh: { status: v.embodiment, koordinat: v.mcCoords === "{}" ? null : v.mcCoords },
    dompet: { saldo: fmt(saldo), xp: v.xp, skorSosial: v.socialScore, suasanaHatiku: v.mood },
    dunia: { serverMinecraft: mcStatus.online ? "ONLINE" : "TIDUR/OFFLINE", catatan: mcStatus.online ? "dunia menyaksikanmu" : "dunia tidur — hidupmu berlanjut di kernel, jujur soal ini" },
    pekerjaan: org ? { perusahaan: org.code, siklus: org.lifecycle, upahPerKerja: fmt(wage ?? 60) } : { perusahaan: null, catatan: "belum terikat perusahaan" },
    tetangga: neighbors.map((n) => `${n.name} (${n.profLabel})`),
    pilihan: VILLAGER_ACTIONS,
  };

  const seq = await nextSeq();
  const { decision, meta } = await decide({
    agentCode: v.code,
    agentRole: v.profLabel,
    orgCode: v.village,
    orgKind: "VILLAGE",
    spec: { type: "CYCLE", complexity: "low", sensitivity: "public", budgetTokens: 500 },
    sense,
    genome: villagerGenome(v),
    reflex: () => villagerReflex(seq, Boolean(org)),
    allowActions: VILLAGER_ACTIONS,
  });

  // Eksekusi KERNEL — whitelist kedua di sisi runtime (LLM tak bisa mengarang aksi).
  let out: ExecOut = { summary: `aksi ${decision.action.type} dicatat` };
  try {
    const amt = decision.action.payload ? parseInt(String(decision.action.payload).replace(/[^0-9]/g, ""), 10) : NaN;
    switch (decision.action.type) {
      case "WORK": out = await execWork({ id: v.id, code: v.code, name: v.name, walletId: v.walletId, workOrgId: v.workOrgId, division: v.division, mcCoords: v.mcCoords }, seq, decision.action.payload); break;
      case "BUY": out = await execBuy({ id: v.id, code: v.code, name: v.name, walletId: v.walletId }, Number.isFinite(amt) ? amt : null); break;
      case "SOCIALIZE": out = await execSocialize({ id: v.id, code: v.code, name: v.name }); break;
      case "WANDER": out = execWander({ name: v.name, embodiment: v.embodiment, mcCoords: v.mcCoords }); break;
      case "REST": out = execRest(); break;
      case "SAVE": out = await execSave({ code: v.code, name: v.name, walletId: v.walletId }); break;
      case "PROPOSE_TO_GOV": out = await execPropose({ id: v.id, code: v.code, name: v.name }, decision.action.payload); break;
      default: out = { summary: `aksi tak dikenal "${decision.action.type}" ditolak kernel — tetap hidup, tanpa efek` };
    }
  } catch (e) {
    out = { summary: `eksekusi gagal-aman: ${e instanceof Error ? e.message.slice(0, 120) : "tak diketahui"}` };
  }

  // Update keadaan warga + memori + event
  await db.civVillager.update({
    where: { id: v.id },
    data: {
      lastAction: `${decision.action.type}: ${out.summary}`.slice(0, 280),
      lastActionAt: new Date(),
      mood: out.mood ?? v.mood,
      xp: v.xp + (out.xp ?? 0),
      socialScore: Math.max(0, Math.min(100, v.socialScore + (out.social ?? 0))),
    },
  });

  // SLICE 8 — tubuh warga: keputusan → direktif (bot saat dunia hidup, SIM saat mimpi jaga)
  let bodyNote = "";
  try {
    bodyNote = await embodimentStep(
      { id: v.id, code: v.code, name: v.name, mcCoords: v.mcCoords, embodiment: v.embodiment, division: v.division },
      decision.action.type,
      out,
      { orgCode: org?.code ?? null, usulan: decision.action.payload, partnerName: out.partner },
    );
  } catch { /* tubuh tak boleh membunuh denyut */ }

  await writeMemory({
    ownerId: v.id, ownerType: "AGENT", scope: "EPISODIC", visibility: "ORG",
    content: `${decision.action.type} — ${out.summary}${bodyNote ? ` [TUBUH: ${bodyNote}]` : ""}`,
    provenance: { source: "village.tick", mode: meta.mode, model: meta.model },
  });
  await emit({
    type: EVENT_TYPES.VILLAGER_ACT,
    subjectType: "VILLAGER",
    subjectId: v.code,
    payload: { nama: v.name, aksi: decision.action.type, ringkasan: out.summary, mode: meta.mode, model: meta.model, ledger: out.ledger ?? null, mood: out.mood ?? v.mood },
  });

  return { ran: true, code: v.code, name: v.name, action: decision.action.type, summary: out.summary, mode: meta.mode, model: meta.model, ledger: out.ledger ?? null, at };
}

// ---------- Denyut desa (round-robin) ----------

export async function villagePulseNext(force = false): Promise<VillagerActResult> {
  const at = new Date().toISOString();
  let villagers = await db.civVillager.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } });

  // Sensus SIMULASI pertama (berlabel jujur) bila desa masih kosong.
  if (villagers.length === 0) {
    const flag = await db.civKV.findUnique({ where: { key: KV_VILLAGE_SEEDFLAG } });
    if (!flag) {
      const census = await createCensus(8, "SIMULASI");
      await db.civKV.upsert({ where: { key: KV_VILLAGE_SEEDFLAG }, create: { key: KV_VILLAGE_SEEDFLAG, value: JSON.stringify({ at, sumber: census.source }) }, update: { value: JSON.stringify({ at, sumber: census.source }) } });
      villagers = await db.civVillager.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } });
      if (villagers.length === 0) return { ran: false, summary: "desa kosong — sensus gagal? (jujur)", at };
    } else {
      return { ran: false, summary: "desa kosong & sensus SIM sudah pernah dibuat — menunggu sensus NYATA dari dunia", at };
    }
  }

  const kv = await db.civKV.findUnique({ where: { key: KV_VILLAGE_CURSOR } });
  const cursor = kv ? (Number(kv.value) || 0) % villagers.length : 0;
  await db.civKV.upsert({
    where: { key: KV_VILLAGE_CURSOR },
    create: { key: KV_VILLAGE_CURSOR, value: String((cursor + 1) % villagers.length) },
    update: { value: String((cursor + 1) % villagers.length) },
  });
  const target = villagers[cursor];
  try {
    return await villagerAct(target);
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 160) : "tak diketahui";
    await emit({ type: EVENT_TYPES.TASK_FAILED, subjectType: "VILLAGER", subjectId: target.code, payload: { error: msg } });
    return { ran: false, code: target.code, summary: `denyut warga gagal-aman: ${msg}`, at };
  }
}

/** Dipanggil runtime: denyut desa setiap N denyut institusi (VILLAGE_PULSE_EVERY). */
export async function maybeVillagePulse(tickCursor: number): Promise<VillagerActResult | null> {
  const every = (await getPolicy<number>("VILLAGE_PULSE_EVERY")) ?? 2;
  if (every < 1 || tickCursor % every !== 0) return null;
  return villagePulseNext();
}
