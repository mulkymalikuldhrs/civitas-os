// CIVITAS OS — memory.ts
// Memori scoped + ACL (PRD §12–14): Company A tidak bisa membaca Company B.
// Kebenaran finansial TIDAK PERNAH hidup di sini — hanya pengalaman/konteks operasional.

import { db } from "@/lib/db";
import { safeParse } from "./events";

export type MemoryScope = "WORKING" | "EPISODIC" | "SEMANTIC" | "ORGANIZATIONAL" | "INSTITUTIONAL";
export type Visibility = "PRIVATE" | "ORG" | "PUBLIC";

export interface WriteMemoryArgs {
  ownerId: string; // orgId atau agentId
  ownerType: "ORG" | "AGENT";
  scope: MemoryScope;
  visibility?: Visibility;
  content: string;
  provenance?: Record<string, unknown>;
}

export async function writeMemory(args: WriteMemoryArgs): Promise<string> {
  const row = await db.civMemory.create({
    data: {
      ownerId: args.ownerId,
      ownerType: args.ownerType,
      scope: args.scope,
      visibility: args.visibility ?? "ORG",
      content: args.content.slice(0, 2000),
      provenance: JSON.stringify(args.provenance ?? {}).slice(0, 1024),
    },
  });
  return row.id;
}

export interface ReadRequester {
  agentId: string;
  orgId: string;
}

/**
 * ACL baca:
 * - pemilik selalu boleh;
 * - memori ORG terbaca bagi agen org yang sama bila visibility != PRIVATE;
 * - PUBLIC terbaca siapa pun;
 * - lintas org dilarang KERAS (isolas Company A vs B; pemerintah tidak otomatis baca memory privat perusahaan).
 */
export async function readMemories(requester: ReadRequester, ownerId: string, ownerType: "ORG" | "AGENT", scope?: MemoryScope, limit = 20) {
  const isOwner = ownerType === "AGENT" ? requester.agentId === ownerId : requester.orgId === ownerId;
  const rows = await db.civMemory.findMany({
    where: { ownerId, ownerType, ...(scope ? { scope } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });
  return rows
    .filter((r) => {
      const vis = r.visibility as Visibility;
      if (isOwner) return true;
      if (vis === "PUBLIC") return true;
      if (ownerType === "ORG" && requester.orgId === ownerId && vis === "ORG") return true;
      return false;
    })
    .map((r) => ({
      id: r.id,
      scope: r.scope,
      visibility: r.visibility,
      content: r.content,
      provenance: safeParse(r.provenance),
      createdAt: r.createdAt.toISOString(),
    }));
}

/** Sense-packet agregat untuk LLM: hitungan + ringkasan terbaru (tanpa isi privat penuh). */
export async function memoryDigest(ownerId: string): Promise<{ total: number; latest: string[] }> {
  const [total, rows] = await Promise.all([
    db.civMemory.count({ where: { ownerId } }),
    db.civMemory.findMany({ where: { ownerId }, orderBy: { createdAt: "desc" }, take: 3, select: { content: true } }),
  ]);
  return { total, latest: rows.map((r) => r.content.slice(0, 160)) };
}
