// ORGANISM · memory.ts — memory interface (fondasi di-hardcode).
// Ring buffer dengan cap dari immune.maxMemoryEntries — limit #5 enforced
// di sini, bukan cuma di dokumen.

import { FILES, readJson, writeJson } from "./store";
import type { MemoryEntry } from "./types";

export function remember(
  entry: Omit<MemoryEntry, "at">,
  maxEntries: number,
): MemoryEntry {
  const full: MemoryEntry = { at: new Date().toISOString(), ...entry };
  const all = readJson<MemoryEntry[]>(FILES.memory, []);
  all.push(full);
  const trimmed = all.slice(-maxEntries);
  writeJson(FILES.memory, trimmed);
  return full;
}

export function recall(n = 20): MemoryEntry[] {
  return readJson<MemoryEntry[]>(FILES.memory, []).slice(-n);
}

export function memorySize(): number {
  return readJson<MemoryEntry[]>(FILES.memory, []).length;
}

export function lastLesson(): string | undefined {
  const all = readJson<MemoryEntry[]>(FILES.memory, []);
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].kind === "LESSON") return all[i].text;
  }
  return undefined;
}

/** Failure is Data — kegagalan wajib membawa hypothesis/result/reason. */
export function rememberFailure(args: {
  hypothesis: string; result: string; reason: string; costMs?: number; maxEntries: number;
}): MemoryEntry {
  return remember(
    {
      kind: "FAILURE",
      text: `GAGAL: ${args.hypothesis} → ${args.result} (${args.reason})`,
      hypothesis: args.hypothesis,
      result: args.result,
      reason: args.reason,
      costMs: args.costMs,
    },
    args.maxEntries,
  );
}
