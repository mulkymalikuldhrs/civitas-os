// FLYBRAIN KERNEL — auth.ts
// Kunci API = turunan username+password user (permintaan eksplisit user).
// FK1_<hex(sha256(username|password))> — WebCrypto, dihitung di perangkat.

import type { Session } from "./types";
import { sha256HexFromStr as sha256Hex } from "./crypto";

const SESSION_KEY = "flybrain.session.v1";

/** Derivasi kunci utama. Password TIDAK PERNAH disimpan di mana pun. */
export async function deriveKey(username: string, password: string): Promise<string> {
  const hex = await sha256Hex(`${username.trim()}|${password}`);
  return `FK1_${hex}`;
}

export async function hashKey(key: string): Promise<string> {
  return sha256Hex(`hash|${key}`);
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.key?.startsWith("FK1_")) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSession(s: Session): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

/** Verifikasi kredensial terhadap sesi aktif. Menerima "Bearer FK1_..." atau "FK1_...". */
export function verifyBearer(header: string | null | undefined): Session | null {
  if (!header) return null;
  const trimmed = header.trim();
  const m = /^(?:Bearer\s+)?(FK1_[0-9a-f]{64})$/i.exec(trimmed);
  if (!m) return null;
  const s = getSession();
  if (!s || s.key.toLowerCase() !== m[1].toLowerCase()) return null;
  return s;
}

/** Label kunci untuk UI: hanya 8 digit pertama & terakhir yang tampil. */
export function maskKey(key: string): string {
  if (key.length < 16) return key;
  return `${key.slice(0, 12)}…${key.slice(-6)}`;
}
