// CIVITAS OS — events.ts
// Event bus immutable: tulis sekali, tidak pernah update/delete (PRD §18/§19).

import { db } from "@/lib/db";

export interface EmitArgs {
  type: string;
  subjectType: string;
  subjectId: string;
  payload?: Record<string, unknown>;
}

/** Tulis event immutable, kembalikan seq. Payload diserialisasi rapat (≤4KB). */
export async function emit(args: EmitArgs): Promise<number> {
  const ev = await db.civEvent.create({
    data: {
      type: args.type,
      subjectType: args.subjectType,
      subjectId: args.subjectId,
      payload: JSON.stringify(args.payload ?? {}).slice(0, 4096),
    },
  });
  return ev.seq;
}

/** Balik sebagian event terbaru untuk UI/audit. */
export async function recentEvents(limit = 50) {
  const rows = await db.civEvent.findMany({
    orderBy: { seq: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });
  return rows.map((e) => ({
    seq: e.seq,
    type: e.type,
    subjectType: e.subjectType,
    subjectId: e.subjectId,
    payload: safeParse(e.payload),
    createdAt: e.createdAt.toISOString(),
  }));
}

export function safeParse(s: string | null | undefined): Record<string, unknown> {
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : { value: v };
  } catch {
    return { raw: s };
  }
}
