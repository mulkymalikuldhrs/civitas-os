// ORGANISM · immune.ts — Sistem imun: 7 limit deklaratif DNA → ENFORCED.
// Setiap limit punya jalur pelanggaran nyata + respons nyata:
//   PAUSE → ROLLBACK → RECORD → KILL/REPAIR. Tidak ada yang "dokumen saja".
// Limit: (1)timeout (2)recursion (3)retry (4)resource/RSS (5)memory-entries
//        (6)network allowlist+timeout (7)tool-permission — plus kill switch.

import process from "node:process";
import { FILES, appendJsonl, readJson, writeJson } from "./store";
import type { ImmuneEvent, ImmuneLimits, ImmuneSignal, OrganismPhase } from "./types";

export class ImmuneViolation extends Error {
  constructor(public signal: ImmuneSignal, message: string) {
    super(`[${signal}] ${message}`);
    this.name = "ImmuneViolation";
  }
}

// ── event store ──────────────────────────────────────────────

export function recordImmuneEvent(ev: ImmuneEvent): void {
  const all = readJson<ImmuneEvent[]>(FILES.immuneEvents, []);
  all.push(ev);
  writeJson(FILES.immuneEvents, all.slice(-200));
  appendJsonl(FILES.eventsLog, { kind: "IMMUNE", ...ev });
}

function nowEv(signal: ImmuneSignal, detail: string, response: ImmuneEvent["response"]): ImmuneEvent {
  return { at: new Date().toISOString(), signal, detail, response };
}

/** Hook fase — diisi loop.ts agar imun bisa PAUSE/KILL organisme nyata. */
let phaseChanger: ((to: OrganismPhase, reason: string) => void) | null = null;
export function setPhaseChanger(fn: (to: OrganismPhase, reason: string) => void): void {
  phaseChanger = fn;
}
function forcePhase(to: OrganismPhase, reason: string): void {
  try { phaseChanger?.(to, reason); } catch { /* jangan crash imun */ }
}

// ── (1) TIMEOUT ──────────────────────────────────────────────

export function withTimeout<T>(p: Promise<T>, limits: ImmuneLimits, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      recordImmuneEvent(nowEv("TIMEOUT", `${label} melewati ${limits.timeoutMs}ms`, "RECORD"));
      reject(new ImmuneViolation("TIMEOUT", `${label} > ${limits.timeoutMs}ms`));
    }, Math.max(50, limits.timeoutMs));
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

// ── (2) RECURSION ────────────────────────────────────────────

let depth = 0;
export function guardRecursion(limits: ImmuneLimits, label: string): () => void {
  depth += 1;
  if (depth > limits.maxRecursion) {
    recordImmuneEvent(nowEv("RECURSION", `${label} depth=${depth} > ${limits.maxRecursion}`, "PAUSE"));
    forcePhase("PAUSED", `recursion depth ${depth}`);
    depth -= 1;
    throw new ImmuneViolation("RECURSION", `depth ${depth} > ${limits.maxRecursion}`);
  }
  return () => { depth = Math.max(0, depth - 1); };
}

export function currentDepth(): number { return depth; }

// ── (4) RESOURCE / RSS ───────────────────────────────────────

export function checkResource(limits: ImmuneLimits, label: string): { rssMb: number; ok: boolean } {
  const rssMb = process.memoryUsage().rss / (1024 * 1024);
  if (rssMb > limits.maxMemoryMb) {
    // ROLLBACK → REPAIR (gc) → masih over → KILL
    recordImmuneEvent(nowEv("RESOURCE", `${label} RSS ${rssMb.toFixed(0)}MB > ${limits.maxMemoryMb}MB — mencoba REPAIR (gc)`, "REPAIR"));
    try { (globalThis as { Bun?: { gc?: (force: boolean) => void } }).Bun?.gc?.(true); } catch { /* noop */ }
    const after = process.memoryUsage().rss / (1024 * 1024);
    if (after > limits.maxMemoryMb) {
      recordImmuneEvent(nowEv("RESOURCE", `REPAIR gagal (${after.toFixed(0)}MB) → KILL organisme`, "KILL"));
      forcePhase("KILLED", `RSS ${after.toFixed(0)}MB > limit`);
      throw new ImmuneViolation("RESOURCE", `RSS ${after.toFixed(0)}MB > ${limits.maxMemoryMb}MB`);
    }
    return { rssMb: after, ok: true };
  }
  return { rssMb, ok: true };
}

// ── (6) NETWORK: allowlist + timeout ─────────────────────────

export function assertNetworkAllowed(url: string, limits: ImmuneLimits): void {
  let host = "";
  try { host = new URL(url).hostname; } catch { throw new ImmuneViolation("NETWORK_BLOCKED", `URL tidak valid: ${url}`); }
  const ok = limits.networkAllowlist.some((h) => host === h || host.endsWith(`.${h}`));
  if (!ok) {
    recordImmuneEvent(nowEv("NETWORK_BLOCKED", `host '${host}' di luar allowlist`, "RECORD"));
    throw new ImmuneViolation("NETWORK_BLOCKED", `host '${host}' tidak diizinkan`);
  }
}

export async function safeFetch(url: string, limits: ImmuneLimits, init?: RequestInit): Promise<Response> {
  assertNetworkAllowed(url, limits);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), Math.max(100, limits.networkTimeoutMs));
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } catch (e) {
    recordImmuneEvent(nowEv("TIMEOUT", `fetch ${url} gagal/timeout (${limits.networkTimeoutMs}ms)`, "RECORD"));
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    clearTimeout(timer);
  }
}

// ── (7) TOOL PERMISSION ──────────────────────────────────────

export function assertToolAllowed(tool: string, limits: ImmuneLimits): void {
  const allowed = limits.toolPermissions[tool] === true;
  if (!allowed) {
    recordImmuneEvent(nowEv("TOOL_DENIED", `tool '${tool}' tidak diizinkan DNA`, "RECORD"));
    throw new ImmuneViolation("TOOL_DENIED", `tool '${tool}' tidak diizinkan`);
  }
}

// ── (3) RETRY + guard utama ──────────────────────────────────

export interface GuardOptions {
  label: string;
  limits: ImmuneLimits;
  retries?: number;
}

/** Jalankan fn dengan timeout+recursion+resource guard dan retry terbatas. */
export async function runGuarded<T>(fn: () => Promise<T>, opts: GuardOptions): Promise<T> {
  const maxRetries = opts.retries ?? opts.limits.maxRetries;
  const release = guardRecursion(opts.limits, opts.label);
  try {
    let attempt = 0;
    for (;;) {
      checkResource(opts.limits, opts.label);
      try {
        return await withTimeout(fn(), opts.limits, opts.label);
      } catch (e) {
        if (e instanceof ImmuneViolation && e.signal !== "TIMEOUT") throw e;
        attempt += 1;
        if (attempt > maxRetries) {
          recordImmuneEvent(nowEv("RETRY_EXHAUSTED", `${opts.label} gagal ${attempt}x`, "RECORD"));
          throw e instanceof Error ? e : new Error(String(e));
        }
      }
    }
  } finally {
    release();
  }
}

// ── KILL SWITCH ──────────────────────────────────────────────

export function checkKillSwitch(raw: string | null): void {
  if (raw) {
    recordImmuneEvent(nowEv("KILL_SWITCH", `kill switch aktif: ${raw}`, "KILL"));
    forcePhase("KILLED", "kill switch file");
    throw new ImmuneViolation("KILL_SWITCH", "kill switch aktif");
  }
}
