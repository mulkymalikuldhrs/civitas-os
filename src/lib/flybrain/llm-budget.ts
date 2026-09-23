// FLYBRAIN KERNEL — llm-budget.ts
// Guard budget LLM per-instance (in-memory) — audit F-08.
// Server tetap AMNESIA: hitungan hanya hidup di RAM proses, hilang saat restart,
// tidak pernah ditulis ke DB/file/cookie. Tujuannya menjaga biaya panggilan LLM
// pada endpoint terbuka (prt.chat / creature.dispatch / /api/organism/chat),
// bukan melacak siapa pun. Stateless-instance tetap amnesia.

import { createHash } from "crypto";

const MAX_PER_MINUTE = 10;
const MAX_PER_HOUR = 100;
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

interface Bucket {
  count: number;
  resetAt: number;
}

const minuteBuckets = new Map<string, Bucket>();
const hourBuckets = new Map<string, Bucket>();
let calls = 0;

function sweep(map: Map<string, Bucket>, now: number): void {
  for (const [k, b] of map) if (now >= b.resetAt) map.delete(k);
}

function peek(map: Map<string, Bucket>, key: string, now: number): number {
  const b = map.get(key);
  if (!b || now >= b.resetAt) return 0;
  return b.count;
}

function bump(map: Map<string, Bucket>, key: string, now: number, windowMs: number): void {
  const b = map.get(key);
  if (!b || now >= b.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count += 1;
}

/** true = panggilan LLM masih dalam budget instance (10/menit · 100/jam per pemanggil). */
export function allowLlmCall(clientKey: string): boolean {
  const now = Date.now();
  calls += 1;
  if (calls % 32 === 0) {
    sweep(minuteBuckets, now);
    sweep(hourBuckets, now);
  }
  if (peek(minuteBuckets, clientKey, now) >= MAX_PER_MINUTE) return false;
  if (peek(hourBuckets, clientKey, now) >= MAX_PER_HOUR) return false;
  bump(minuteBuckets, clientKey, now, MINUTE_MS);
  bump(hourBuckets, clientKey, now, HOUR_MS);
  return true;
}

/** Kunci pemanggil: bearer (dihash ringan) bila ada, selain itu IP, selain itu "anon". */
export function llmClientKey(req: Request, bearerRaw: string | null): string {
  if (bearerRaw) {
    const h = createHash("sha256").update(bearerRaw).digest("hex").slice(0, 20);
    return `bearer:${h}`;
  }
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0]?.trim() : req.headers.get("x-real-ip");
  return ip ? `ip:${ip}` : "anon";
}

export const LLM_BUDGET_LABEL = `maks ${MAX_PER_MINUTE} panggilan LLM/menit · ${MAX_PER_HOUR}/jam per pemanggil`;
