// CIVITAS OS — minecraft.ts
// World layer (PRD §16/§24): Minecraft = perwujudan fisik, BUKAN sumber kebenaran finansial.
// Ping RakNet Bedrock NYATA (UDP unconnected_ping) tanpa dependensi berat.
// Server pemilik: mulkymalikuldhr.aternos.me:19132 (Aternos tidur otomatis → status jujur).

import * as dgram from "node:dgram";
import { db } from "@/lib/db";
import { emit } from "./events";
import { KV_MC_CACHE, EVENT_TYPES } from "./types";
import { safeParse } from "./events";
import { mcTarget } from "./config";

const MAGIC = Buffer.from("00ffff00fefefefefdfdfdfd12345678", "hex");

export interface McStatus {
  online: boolean;
  latencyMs: number | null;
  edition?: string;
  motd?: string;
  protocol?: number;
  version?: string;
  players?: number;
  maxPlayers?: number;
  gamemode?: string;
  checkedAt: string;
  error?: string;
}

function readUnsignedVarint(buf: Buffer, offset: number): { value: number; offset: number } {
  let num = 0, shift = 0, i = offset;
  while (true) {
    const b = buf[i];
    if (b === undefined) throw new Error("varint out of range");
    num |= (b & 0x7f) << shift;
    i += 1;
    if ((b & 0x80) === 0) break;
    shift += 7;
    if (shift > 28) throw new Error("varint terlalu panjang");
  }
  return { value: num >>> 0, offset: i };
}

/** Ping UDP RakNet: kirim unconnected_ping, parse unconnected_pong (0x1c). */
export function pingBedrock(host: string, port: number, timeoutMs = 4000): Promise<McStatus> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const sock = dgram.createSocket("udp4");
    const done = (st: McStatus) => {
      try { sock.close(); } catch { /* sudah tertutup */ }
      resolve(st);
    };
    const timer = setTimeout(() => done({ online: false, latencyMs: null, checkedAt: new Date().toISOString(), error: "timeout — server tidur/tak terjangkau (Aternos free tidur otomatis)" }), timeoutMs);

    sock.on("message", (msg) => {
      clearTimeout(timer);
      try {
        if (msg[0] !== 0x1c) return done({ online: false, latencyMs: null, checkedAt: new Date().toISOString(), error: `balasan tak dikenal 0x${msg[0]?.toString(16)}` });
        // 0x1c: id(1)+time(8)+serverGUID(8)+MAGIC(16)+len(2)+str → len di 33, str di 35
        const strLen = msg.readUInt16BE(33);
        const str = msg.slice(35, 35 + strLen).toString("utf8");
        const f = str.split(";");
        const st: McStatus = {
          online: true,
          latencyMs: Date.now() - t0,
          edition: f[0] ?? undefined,
          motd: f[1] ?? undefined,
          protocol: f[2] ? Number(f[2]) : undefined,
          version: f[3] ?? undefined,
          players: f[4] ? Number(f[4]) : undefined,
          maxPlayers: f[5] ? Number(f[5]) : undefined,
          gamemode: f[8] ?? undefined,
          checkedAt: new Date().toISOString(),
        };
        done(st);
      } catch (e) {
        done({ online: false, latencyMs: null, checkedAt: new Date().toISOString(), error: e instanceof Error ? e.message : "parse gagal" });
      }
    });
    sock.on("error", (e) => {
      clearTimeout(timer);
      done({ online: false, latencyMs: null, checkedAt: new Date().toISOString(), error: e.message.slice(0, 160) });
    });

    const pkt = Buffer.concat([
      Buffer.from([0x01]),
      Buffer.alloc(8), // timestamp di offset 1
      MAGIC, // magic di offset 9
      Buffer.alloc(8), // client GUID di offset 25 — format RakNet: id|time|magic|guid
    ]);
    pkt.writeBigInt64BE(BigInt(Date.now()), 1);
    sock.send(pkt, port, host, (err) => {
      if (err) {
        clearTimeout(timer);
        done({ online: false, latencyMs: null, checkedAt: new Date().toISOString(), error: err.message.slice(0, 160) });
      }
    });
  });
}

/** Status dengan cache KV 15 detik (hemat UDP + tahan burst UI). */
export async function cachedStatus(force = false): Promise<McStatus> {
  if (!force) {
    const row = await db.civKV.findUnique({ where: { key: KV_MC_CACHE } });
    if (row) {
      const cached = safeParse(row.value) as unknown as McStatus & { cachedAt?: number };
      if (cached.cachedAt && Date.now() - cached.cachedAt < 15_000) return cached;
    }
  }
  const t = await mcTarget();
  const st = await pingBedrock(t.host, t.port);
  const withCache = { ...st, host: t.host, port: t.port, cachedAt: Date.now() } as McStatus & { cachedAt: number };
  await db.civKV.upsert({
    where: { key: KV_MC_CACHE },
    create: { key: KV_MC_CACHE, value: JSON.stringify(withCache) },
    update: { value: JSON.stringify(withCache) },
  });
  // Event hanya saat status BERUBAH (anti-spam log immutable)
  const prev = await db.civEvent.findFirst({ where: { type: EVENT_TYPES.MC_STATUS }, orderBy: { seq: "desc" } });
  const prevOnline = prev ? Boolean(safeParse(prev.payload).online) : null;
  if (prevOnline !== st.online) {
    await emit({ type: EVENT_TYPES.MC_STATUS, subjectType: "MINECRAFT", subjectId: `${t.host}:${t.port}`, payload: { online: st.online, latencyMs: st.latencyMs, version: st.version ?? null, players: st.players ?? null, host: t.host } });
  }
  return st;
}

/** Registry pemetaan entitas dunia ↔ peradaban. */
export async function worldEntities() {
  const rows = await db.civWorldEntity.findMany({ include: { org: true }, orderBy: { mcType: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    mcType: r.mcType,
    mcName: r.mcName,
    mcCoords: safeParse(r.mcCoords),
    civType: r.civType,
    civCode: r.civCode,
    status: r.status,
    orgName: r.org?.name ?? null,
  }));
}
