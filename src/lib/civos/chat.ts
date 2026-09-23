// CIVITAS OS — chat.ts (SLICE 10)
// Interaksi LANGSUNG dengan warga (mandat #1): dashboard ⇄ warga ⇄ dunia.
// HUMAN → warga: otak LLM warga menjawab dengan kepribadian+memori; balasan juga
// diantrekan sebagai direktif SPEAK agar diucapkan in-world saat bot online.
// WORLD → dashboard: chat dunia (pemilik bermain) direlay & dicatat jujur.

import { db } from "@/lib/db";
import { emit } from "./events";
import { writeMemory } from "./memory";
import { enqueueDirective } from "./directives";
import { chatLLM } from "./router";
import { EVENT_TYPES } from "./types";
import { divisionMeta } from "./types";

export const CHAT_MAX_LEN = 220;
export const CHAT_TAKE = 40;

export interface ChatRow {
  id: string;
  channel: string;
  from: string;
  villagerCode: string | null;
  senderName: string;
  body: string;
  route: string | null;
  directiveId: string | null;
  at: string;
}

export async function recentChat(limit = CHAT_TAKE, sinceId?: string): Promise<ChatRow[]> {
  const rows = await db.civChatMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });
  let list = rows.map((m) => ({
    id: m.id,
    channel: m.channel,
    from: m.from,
    villagerCode: m.villagerCode,
    senderName: m.senderName,
    body: m.body,
    route: m.route === "{}" ? null : m.route,
    directiveId: m.directiveId,
    at: m.createdAt.toISOString(),
  }));
  if (sinceId) {
    const idx = list.findIndex((r) => r.id === sinceId);
    if (idx >= 0) list = list.slice(0, idx);
  }
  return list;
}

function personaOf(v: { name: string; code: string; profession: string; profLabel: string; division: string; village: string; mood: string; xp: number; socialScore: number }): string {
  const meta = divisionMeta(v.division);
  return `Kamu adalah ${v.name} (${v.code}), warga desa "${v.village}" di peradaban Nusantara Digital. Profesi: ${v.profLabel}; guild: ${meta.label} (${meta.desc}). Mood: ${v.mood}; XP: ${v.xp}; skor sosial: ${v.socialScore}. Balas DENGAN BAHASA INDONESIA SANTAI seperti warga desa, maksimal 2 kalimat, tanpa tanda baya meta. Jangan mengaku sebagai AI/model; kamu warga yang punya pekerjaan dan tetangga.`;
}

/** Otak warga menjawab pesan. Semua keputusan bahasa via router; eksekusi di kernel. */
export async function askCitizen(opts: {
  villagerCode: string;
  body: string;
  channel: "DASHBOARD" | "WORLD";
  senderName?: string;
}): Promise<{ ok: boolean; error?: string; reply?: string; directiveId?: string }> {
  const body = opts.body.trim().slice(0, CHAT_MAX_LEN);
  if (!body) return { ok: false, error: "pesan kosong" };

  const v = await db.civVillager.findFirst({
    where: { code: opts.villagerCode, status: "ACTIVE" },
    include: { workOrg: true },
  });
  if (!v) return { ok: false, error: `warga ${opts.villagerCode} tidak ditemukan/aktif` };

  await db.civChatMessage.create({
    data: {
      channel: opts.channel,
      from: "HUMAN",
      villagerId: v.id,
      villagerCode: v.code,
      senderName: opts.senderName ?? "Pemilik",
      body,
    },
  });

  const mem = await db.civMemory.findMany({
    where: { ownerId: v.id, scope: { in: ["EPISODIC", "WORKING"] } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const prompt = [
    personaOf({ name: v.name, code: v.code, profession: v.profession, profLabel: v.profLabel, division: v.division, village: v.village, mood: v.mood, xp: v.xp, socialScore: v.socialScore }),
    mem.length > 0 ? `Ingatan terakhir kamu: ${mem.map((m) => `· ${m.content}`).join(" | ")}` : "Belum ada ingatan khusus.",
    opts.senderName && opts.senderName !== "Pemilik" ? `Percakapan in-game dari ${opts.senderName}: "${body}"` : `Pesan dari pemilik peradaban: "${body}"`,
    "Jawab sekarang:",
  ].join("\n");

  let reply: string;
  let routeMeta = { model: "reflex", mode: "REFLEX", latencyMs: 0 };
  try {
    const r = await chatLLM(prompt);
    reply = String(r.text ?? "").trim().slice(0, CHAT_MAX_LEN) || "…";
    routeMeta = { model: r.model ?? "reflex", mode: r.mode ?? "REFLEX", latencyMs: r.latencyMs ?? 0 };
  } catch {
    reply = "(mood tenang) Baik, akan kupikirkan.";
  }

  // Direktif SPEAK agar suara warga hadir di dunia (bot online → relay in-world).
  let directiveId: string | null = null;
  try {
    const d = await enqueueDirective(
      { id: v.id, code: v.code, name: v.name, mcCoords: v.mcCoords },
      "SPEAK",
      { message: `${v.name}: ${reply}` },
    );
    directiveId = d.id ?? null;
  } catch { /* antrean penuh — jujur dibiarkan tanpa relay */ }

  await db.civChatMessage.create({
    data: {
      channel: opts.channel,
      from: "CITIZEN",
      villagerId: v.id,
      villagerCode: v.code,
      senderName: v.name,
      body: reply,
      route: JSON.stringify(routeMeta),
      directiveId,
    },
  });

  await writeMemory({ ownerId: v.id, ownerType: "AGENT", scope: "EPISODIC", content: `Bicara dengan pemilik: "${body}" → jawab: "${reply}"`, provenance: { source: "chat", channel: opts.channel } });
  await emit({ type: EVENT_TYPES.VILLAGER_ACT, subjectType: "VILLAGER", subjectId: v.id, payload: { aksi: "CHAT", saluran: opts.channel, balasan: reply.slice(0, 80), model: routeMeta.model } });

  return { ok: true, reply, directiveId: directiveId ?? undefined };
}

/** Chat dunia dari pemain in-game → dicatat + (opsional) dirutekan ke warga yang dipanggil. */
export async function worldChatInbound(opts: { senderName: string; message: string }): Promise<{ routedTo?: string; reply?: string }> {
  const msg = opts.message.trim().slice(0, CHAT_MAX_LEN);
  await db.civChatMessage.create({
    data: { channel: "WORLD", from: "HUMAN", villagerCode: null, senderName: opts.senderName, body: msg },
  });
  // Rute: sebut nama warga di pesan → warga itu; selain itu warga terakhir aktif (round-robin sosial).
  const villagers = await db.civVillager.findMany({ where: { status: "ACTIVE" }, orderBy: { updatedAt: "asc" }, take: 24 });
  if (villagers.length === 0) return {};
  const lower = msg.toLowerCase();
  const named = villagers.find((v) => lower.includes(v.name.toLowerCase()));
  const target = named ?? villagers[0];
  const r = await askCitizen({ villagerCode: target.code, body: msg, channel: "WORLD", senderName: opts.senderName });
  return { routedTo: target.code, reply: r.reply };
}
