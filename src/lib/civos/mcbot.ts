// CIVITAS OS — mcbot.ts (SLICE 10, versi 2)
// BOT MINECRAFT NYATA (bedrock-protocol) — masuk dunia, MENGENALI warga desanya,
// MENDENGAR chat pemilik, MENJAWAB sebagai warga, MENGGERAKKAN tubuh warga:
//   SPEAK → relay chat berlabel nama warga; MOVE/PATROL → tp ber-anchor;
//   BUILD → /civ fill (blok FISIK via plugin CivitasBridge, butuh OP).
// Target server dari KONFIGURASI (lokal PMMP maupun Aternos online). Sensus CENSUS
// mengikat entitas villager nyata; summon otomatis mengisi desa (butuh CivitasBridge).
// REALITY WINS: kegagalan join/chat/OP dicatat jujur — tidak ada sukses palsu.

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { emit } from "./events";
import { cachedStatus } from "./minecraft";
import { writeMemory } from "./memory";
import { observeVillagers, parseVillagerEntity, type McVillagerObs } from "./villagers";
import { EVENT_TYPES, KV_MC_CACHE } from "./types";
import { safeParse } from "./events";
import { mcTarget, getConfigValue } from "./config";
import { worldChatInbound } from "./chat";

export const BOT_NAME = "CIVITAS_AGENT";
const KV_BOT = "mcbot.lastAttempt";

export interface BotResult {
  joined: boolean;
  detail: string;
  chatSent?: boolean;
  syncedEntities?: number;
  censusVillagers?: number;
  censusNew?: number;
  directivesApplied?: number;
  directivesFailed?: number;
  chatInbound?: number;
  chatReplied?: number;
  summoned?: number;
  at: string;
}

let running = false;

/** Kirim chat ke dunia — skema 1.26.30 butuh category=1 (authored); versi lama fallback tanpa category. */
function sendChat(client: { write: (name: string, params: object) => void }, message: string): void {
  const base = { type: "chat", needs_translation: false, source_name: BOT_NAME, message: String(message).slice(0, 220), xuid: "", platform_chat_id: "", filtered_message: "" };
  try {
    client.write("text", { ...base, category: 1 });
  } catch {
    client.write("text", base);
  }
}

/** Kirim perintah dunia (butuh OP; kegagalan tetap teraudit via command_output). */
function sendCommand(client: { write: (name: string, params: object) => void }, command: string): void {
  // Skema 1.26.30: { command, origin{type,uuid,request_id,player_unique_id}, internal, version }
  client.write("command_request", {
    command: command.startsWith("/") ? command.slice(1) : command,
    origin: { type: "player", uuid: randomUUID(), request_id: randomUUID(), player_entity_id: 0 },
    internal: false,
    version: "-1",
  });
}

/** Coba masuk dunia bila server online. Aman dipanggil berkali-kali. */
export async function attemptBotJoin(force = false): Promise<BotResult> {
  const at = new Date().toISOString();
  if (running) return { joined: false, detail: "bot sedang berjalan", at };

  const last = await db.civKV.findUnique({ where: { key: KV_BOT } });
  const lastAttempt = last ? (safeParse(last.value) as { at?: string }) : {};
  if (!force && lastAttempt.at && Date.now() - new Date(lastAttempt.at).getTime() < 5 * 60 * 1000) {
    return { joined: false, detail: "cooldown 5 menit antar percobaan", at };
  }
  await db.civKV.upsert({ where: { key: KV_BOT }, create: { key: KV_BOT, value: JSON.stringify({ at }) }, update: { value: JSON.stringify({ at }) } });

  const target = await mcTarget();
  const status = await cachedStatus(false);
  if (!status.online) {
    return { joined: false, detail: `server OFFLINE/TIDUR (${status.error ?? "-"} — target ${target.host}:${target.port})`, at };
  }

  running = true;
  const autoReply = (await getConfigValue("chat.autoReply")) !== "false";
  try {
    // Impor runtime-only: chunk bedrock-protocol menyembunyikan diri dari bundler (ADR arsip Task 10).
    const importBedrock = new Function("return import('bedrock-protocol')") as () => Promise<typeof import("bedrock-protocol")>;
    const bedrock = await importBedrock();
    const client = bedrock.createClient({
      host: target.host,
      port: target.port,
      username: BOT_NAME,
      offline: true,
      connectTimeout: 20_000,
    });

    const result = await new Promise<BotResult>((resolve) => {
      let chatSent = false;
      const villagers: McVillagerObs[] = [];
      const seenUids = new Set<string>();
      const worldMsgs: { source: string; message: string }[] = [];
      let chatReplied = 0;

      const onPacket = (des: { data?: { name?: string; params?: unknown } }) => {
        const name = des?.data?.name ?? "";
        if (!/^add_(entity_actor|actor|entity)$/.test(name)) return;
        const obs = parseVillagerEntity(des.data?.params);
        if (obs && !seenUids.has(obs.entityUid)) {
          seenUids.add(obs.entityUid);
          villagers.push(obs);
        }
      };
      client.on("packet", onPacket);

      // DENGAR chat dunia — interaksi langsung saat pemilik bermain (mandat #1).
      const onText = (des: { data?: { name?: string; params?: Record<string, unknown> } }) => {
        if (des?.data?.name !== "text") return;
        const p = des.data!.params ?? {};
        const pType = String(p.type ?? "raw");
        const source = String(p.source_name ?? "");
        const message = String(p.message ?? "");
        if (pType !== "chat" || !source || source === BOT_NAME) return;
        if (/^%|§/.test(message)) return; // pesan sistem/terjemahan server
        if (worldMsgs.length >= 3) return; // budget percakapan per sesi
        worldMsgs.push({ source, message });
      };
      client.on("packet", onText);

      const timer = setTimeout(() => {
        try { client.disconnect(); } catch { /* noop */ }
        resolve({ joined: false, detail: "timeout 75 dtk saat sesi dunia", at });
      }, 75_000);

      client.on("spawn", async () => {
        try {
          sendChat(client, `CIVITAS OS hadir — peradaban Nusantara Digital online. Bot: ${BOT_NAME} (Bedrock ${target.version})`);
          chatSent = true;
        } catch { /* chat gagal tak fatal */ }

        // Koleksi entitas mengalir saat chunk dimuat — jendela 12 dtk.
        setTimeout(async () => {
          try {
            let census = { embodied: 0, bound: 0, note: "tidak ada observasi" };
            if (villagers.length > 0) {
              try {
                census = await observeVillagers(villagers);
                await emit({ type: EVENT_TYPES.VILLAGE_CENSUS, subjectType: "MINECRAFT", subjectId: `${target.host}:${target.port}`, payload: { sumber: "CENSUS", terobservasi: villagers.length, embodied: census.embodied, identitasBaru: census.bound, catatan: census.note } });
              } catch (ce) {
                await emit({ type: EVENT_TYPES.TASK_FAILED, subjectType: "MINECRAFT", subjectId: `${target.host}:${target.port}`, payload: { error: `sensus nyata gagal: ${ce instanceof Error ? ce.message.slice(0, 120) : "?"}` } });
              }
              sendChat(client, `Sensus desa: ${villagers.length} villager terobservasi — ${census.bound} identitas baru naik derajat menjadi agen otonom.`);
            } else if ((await getConfigValue("mc.autoSummon")) === "true") {
              // Desa kosong → summon via konsol lokal (plugin CivitasBridge). Remote tanpa konsol: jujur dilewati.
              const { localConsoleCommand } = await import("./console");
              const want = Number((await getConfigValue("mc.summonCount")) || "8");
              const r = await localConsoleCommand(`civ summon ${want}`, "KERNEL");
              sendChat(client, r.ok ? `Desa kosong — ${r.response}` : `Summon gagal: ${r.response}`);
            }

            // Balas chat pemain (interaksi langsung): rute ke otak warga → relay jawaban.
            for (const wm of worldMsgs) {
              if (!autoReply) break;
              try {
                const routed = await worldChatInbound({ senderName: wm.source, message: wm.message });
                if (routed.reply) {
                  chatReplied += 1;
                  sendChat(client, `[${routed.routedTo ?? "desa"}] ${routed.reply}`);
                }
              } catch { /* gagal rute tetap jujur */ }
            }

            // DIREKTIF TUBUH WARGA: SPEAK/MOVE/PATROL/BUILD (blok fisik via /civ fill).
            let directivesApplied = 0;
            let directivesFailed = 0;
            let movesDispatched = 0;
            const pendingCmds = new Map<string, { directiveId: string; villagerId: string; coords?: { x: number; y: number; z: number } }>();
            try {
              const { claimDirectivesForBot, markDispatched, markApplied, markFailed } = await import("./directives");
              const claimed = await claimDirectivesForBot();

              const onCmdOut = (des: { data?: { name?: string; params?: unknown } }) => {
                if (des?.data?.name !== "command_output") return;
                const p = (des.data?.params ?? {}) as { output_messages?: { message?: string; success?: boolean }[] };
                const text = (p.output_messages ?? []).map((m) => String(m?.message ?? "")).join(" | ").slice(0, 240);
                for (const [cmd, meta] of Array.from(pendingCmds.entries())) {
                  if (!text) continue;
                  const failed = /no targets|not matched|unknown|permission|denied|invalid|GAGAL/i.test(text);
                  if (failed) {
                    void markFailed(meta.directiveId, `dunia menolak: ${text}`).then(() => { directivesFailed += 1; });
                  } else {
                    void markApplied(meta.directiveId, `dunia mengonfirmasi: ${text}`, meta.villagerId, meta.coords).then(() => { directivesApplied += 1; });
                  }
                  pendingCmds.delete(cmd);
                }
              };
              client.on("packet", onCmdOut);

              const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
              for (const d of claimed) {
                if (d.chatMessage) {
                  try {
                    // SPEAK/BUILD/MINE — suara warga: relay berlabel; BUILD/MINE dianonsir + eksekusi fisik.
                    if ((d.kind === "BUILD" || d.kind === "MINE") && d.payload) {
                      const site = d.payload.site;
                      const blocks = d.payload.blocks ?? ["planks"];
                      const fp = Math.min(Math.max(d.payload.footprint ?? 2, 1), 4);
                      if (site) {
                        const block = String(blocks[0] ?? "planks").replace(/[^a-z_]/gi, "");
                        const cmd = `civ fill ${site.x} ${site.y} ${site.z} ${site.x + fp - 1} ${site.y} ${site.z + fp - 1} ${block}`;
                        await markDispatched(d.id);
                        sendCommand(client, cmd);
                        pendingCmds.set(cmd, { directiveId: d.id, villagerId: d.villagerId, coords: site });
                        sendChat(client, d.chatMessage);
                        await sleep(600);
                        continue;
                      }
                    }
                    sendChat(client, d.chatMessage);
                    await markApplied(d.id, d.kind === "SPEAK"
                      ? "relay chat terkirim (berlabel nama warga — suara otentik warga melalui bot)"
                      : `${d.kind} dianonsir ke dunia — rencana guild tercatat`);
                    directivesApplied += 1;
                  } catch (ce) {
                    await markFailed(d.id, `chat gagal: ${ce instanceof Error ? ce.message.slice(0, 100) : "?"}`);
                    directivesFailed += 1;
                  }
                } else if (d.command) {
                  try {
                    await markDispatched(d.id);
                    sendCommand(client, d.command);
                    pendingCmds.set(d.command, { directiveId: d.id, villagerId: d.villagerId, coords: d.targetCoords });
                    movesDispatched += 1;
                  } catch (ce) {
                    await markFailed(d.id, `command gagal dikirim: ${ce instanceof Error ? ce.message.slice(0, 100) : "?"}`);
                    directivesFailed += 1;
                  }
                }
              }
              if (claimed.length > 0) {
                sendChat(client, `Direktif warga: ${claimed.length} dieksekusi — tubuh warga di bawah kendali otonom mereka.`);
              }
            } catch (de) {
              await emit({ type: EVENT_TYPES.TASK_FAILED, subjectType: "MINECRAFT", subjectId: `${target.host}:${target.port}`, payload: { error: `direktif tubuh gagal: ${de instanceof Error ? de.message.slice(0, 120) : "?"}` } });
            }

            const updated = await db.civWorldEntity.updateMany({ data: { status: "SYNCED", lastSyncAt: new Date() } });
            await emit({ type: EVENT_TYPES.MC_STATUS, subjectType: "MINECRAFT", subjectId: `${target.host}:${target.port}`, payload: { online: true, bot: BOT_NAME, chatSent, synced: updated.count, villagers: villagers.length, censusNew: census.bound, directives: { applied: directivesApplied, failed: directivesFailed }, chatInbound: worldMsgs.length, chatReplied, mode: "BOT_JOIN+SENSUS+CHAT2ARAH+DIREKTIF" } });
            await writeMemory({ ownerId: "civ-world", ownerType: "ORG", scope: "EPISODIC", visibility: "PUBLIC", content: `Bot ${BOT_NAME} sesi dunia (${target.host}:${target.port}) ${at}: sensus ${villagers.length} villager (${census.bound} baru), chat masuk ${worldMsgs.length} dibalas ${chatReplied}, direktif ${directivesApplied} applied/${directivesFailed} failed.`, provenance: { source: "mcbot", sensus: villagers.length, chat: worldMsgs.length } });

            // MOVE butuh jendela ekstra menunggu command_output dunia.
            setTimeout(() => {
              try { client.disconnect(); } catch { /* noop */ }
              clearTimeout(timer);
              resolve({ joined: true, detail: `bot masuk dunia; sensus ${villagers.length} villager (${census.bound} baru); chat masuk ${worldMsgs.length} → balas ${chatReplied}; direktif ${directivesApplied}/${directivesFailed}; ${updated.count} entitas SYNCED`, chatSent, syncedEntities: updated.count, censusVillagers: villagers.length, censusNew: census.bound, directivesApplied, directivesFailed, chatInbound: worldMsgs.length, chatReplied, at });
            }, movesDispatched > 0 ? 9_000 : 4_500);
          } catch (e) {
            clearTimeout(timer);
            resolve({ joined: false, detail: `pasca-spawn gagal: ${e instanceof Error ? e.message.slice(0, 160) : "?"}`, chatSent, at });
          }
        }, 12_000);
      });

      client.on("kick", (reason: unknown) => {
        clearTimeout(timer);
        resolve({ joined: false, detail: `ditendang server: ${JSON.stringify(reason).slice(0, 160)}`, at });
      });
      client.on("error", (e: Error) => {
        clearTimeout(timer);
        resolve({ joined: false, detail: `gagal join: ${e.message.slice(0, 160)} (xbox-auth/versi protokol dilaporkan apa adanya)`, at });
      });
    });

    return result;
  } catch (e) {
    return { joined: false, detail: `kesalahan bot: ${e instanceof Error ? e.message.slice(0, 160) : "tidak diketahui"}`, at };
  } finally {
    running = false;
  }
}

/** Dipanggil heartbeat: bila online + autoJoin + ada alasan → coba bot sekali. */
export async function maybeAutoJoin(): Promise<BotResult | null> {
  if ((await getConfigValue("mc.autoJoin")) === "false") return null;
  const row = await db.civKV.findUnique({ where: { key: KV_MC_CACHE } });
  if (!row) return null;
  const st = safeParse(row.value) as { online?: boolean };
  if (st.online !== true) return null;
  const last = await db.civKV.findUnique({ where: { key: KV_BOT } });
  const lastSynced = last ? (safeParse(last.value) as { synced?: boolean; at?: string }) : {};
  const queued = await db.civVillagerDirective.count({ where: { status: "QUEUED" } });
  const simLeft = await db.civVillager.count({ where: { status: "ACTIVE", source: "SIMULASI" } });
  const recent = lastSynced.at && Date.now() - new Date(lastSynced.at).getTime() < 10 * 60 * 1000;
  const reason = queued > 0 || simLeft > 0 || !lastSynced.synced;
  if (recent && !reason) return null;
  const r = await attemptBotJoin(true);
  if (r.joined) {
    await db.civKV.upsert({ where: { key: KV_BOT }, create: { key: KV_BOT, value: JSON.stringify({ at: r.at, synced: true }) }, update: { value: JSON.stringify({ at: r.at, synced: true }) } });
  }
  return r;
}
