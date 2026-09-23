// CIVITAS OS — runtime.ts
// Denyut otonom peradaban (PRD §25): OBSERVE→INTERPRET→PLAN→CHECK POLICY→EXECUTE→EVENT→MEMORY→REPLAN.
// Satu denyut = SATU organ bekerja (rotasi round-robin; budget konstitusi 1 keputusan/denyut/organ).
// TIDAK PERNAH melempar error ke pemanggil — kegagalan organ dicatat sebagai event.

import { db } from "@/lib/db";
import { emit } from "./events";
import { ensureSeed } from "./seed";
import { companyCycle } from "./company";
import { governmentCycle } from "./government";
import { writeMemory } from "./memory";
import { computeMetrics, alertOncePerHour } from "./economy";
import { cachedStatus } from "./minecraft";
import { maybeVillagePulse } from "./village";
import { EVENT_TYPES, KV_CURSOR, KV_LAST_TICK } from "./types";
import { safeParse } from "./events";

export interface TickSummary {
  tick: number;
  target: string;
  kind: string;
  summary: string;
  mode?: string;
  model?: string;
  executed?: string;
  /** SLICE 7: hasil denyut desa yang berjalan bersamaan denyut institusi ini. */
  village?: string;
  durationMs: number;
  at: string;
}

/** Jalankan SATU denyut. Aman dipanggil dari API mana pun, sekalipun bersamaan (cursor KV). */
export async function heartbeatTick(forceTarget?: string): Promise<TickSummary> {
  const t0 = Date.now();
  const seed = await ensureSeed();

  const orgs = await db.civOrg.findMany({
    where: { kind: { in: ["GOVERNMENT", "COMPANY", "CITY"] } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, kind: true, lifecycle: true },
  });

  const kv = await db.civKV.findUnique({ where: { key: KV_CURSOR } });
  const cursor = kv ? (Number(safeParse(kv.value).idx ?? 0) % Math.max(orgs.length, 1)) : 0;
  const target = forceTarget ? (orgs.find((o) => o.code === forceTarget) ?? orgs[cursor]) : orgs[cursor];
  await db.civKV.upsert({
    where: { key: KV_CURSOR },
    create: { key: KV_CURSOR, value: JSON.stringify({ idx: (cursor + 1) % Math.max(orgs.length, 1) }) },
    update: { value: JSON.stringify({ idx: (cursor + 1) % Math.max(orgs.length, 1) }) },
  });

  let summary: TickSummary;
  if (!target) {
    summary = { tick: cursor, target: "-", kind: "-", summary: "belum ada organ — seed gagal?", durationMs: Date.now() - t0, at: new Date().toISOString() };
  } else {
    try {
      if (target.kind === "GOVERNMENT") {
        const r = await governmentCycle();
        summary = { tick: cursor, target: target.code, kind: "GOVERNMENT", summary: `${r.step}: ${r.detail}`, durationMs: Date.now() - t0, at: new Date().toISOString() };
      } else if (target.kind === "COMPANY" && target.code === "COMP-QUAN") {
        // Kantor Kuant: paper-trading SIMULASI (tanpa LLM; risk gate di luar LLM)
        const { quantCycle } = await import("./expand");
        const q = await quantCycle(target.id);
        await writeMemory({ ownerId: target.id, ownerType: "ORG", scope: "WORKING", content: q.decision, provenance: { source: "quantCycle", mode: "SIMULASI" } });
        summary = { tick: cursor, target: target.code, kind: "QUANT", summary: q.decision, mode: "REFLEX", model: "quant-sim-v1", durationMs: Date.now() - t0, at: new Date().toISOString() };
      } else if (target.kind === "COMPANY") {
        const r = await companyCycle(target.id);
        summary = {
          tick: cursor,
          target: target.code,
          kind: "COMPANY",
          summary: r.decision.decision,
          mode: r.meta.mode,
          model: r.meta.model,
          executed: r.executed,
          durationMs: Date.now() - t0,
          at: new Date().toISOString(),
        };
      } else {
        // CITY: pemeliharaan ringan (memori kota) — infrastruktur nyata menyusul di slice 3+
        const mayor = await db.civAgent.findFirst({ where: { orgId: target.id, status: "ACTIVE" } });
        if (mayor) {
          await writeMemory({ ownerId: target.id, ownerType: "ORG", scope: "WORKING", content: `Patroli kota: infrastruktur berdiri; menunggu alokasi anggaran kota dari pemerintah.`, provenance: { oleh: mayor.code } });
        }
        summary = { tick: cursor, target: target.code, kind: "CITY", summary: "patroli kota — kondisi normal", durationMs: Date.now() - t0, at: new Date().toISOString() };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 200) : "kesalahan tak dikenal";
      await emit({ type: EVENT_TYPES.TASK_FAILED, subjectType: "ORG", subjectId: target.id, payload: { org: target.code, error: msg } });
      summary = { tick: cursor, target: target.code, kind: target.kind, summary: `refleks gagal-aman: ${msg}`, durationMs: Date.now() - t0, at: new Date().toISOString() };
    }
  }

  // SLICE 7 — denyut desa: setiap N denyut institusi, SATU warga bertindak.
  // (Sensus SIMULASI pertama dibuat otomatis bila desa kosong — berlabel jujur.)
  try {
    const vp = await maybeVillagePulse(cursor);
    if (vp) summary.village = `${vp.code ?? "-"}: ${vp.summary}`;
  } catch { /* desa tak boleh membunuh denyut institusi */ }

  // Sustainabilitas + status Minecraft + mirror Supabase dicek tiap denyut (murah, ber-cache)
  try {
    const metrics = await computeMetrics();
    await alertOncePerHour(metrics);
    await cachedStatus(false);
    const { pushMirror } = await import("./supabase");
    await pushMirror(); // idempoten, ber-cursor — gagal jaringan tidak membunuh denyut
    const { maybeAutoJoin } = await import("./mcbot");
    await maybeAutoJoin(); // server online → bot masuk dunia + sensus + direktif (bounded, cooldown)
    const { expireStaleDirectives } = await import("./directives");
    await expireStaleDirectives(); // SLICE 8 — tubuh tak menerima perintah basi (TTL)
  } catch { /* jangan biarkan monitoring membunuh denyut */ }

  await emit({ type: EVENT_TYPES.HEARTBEAT, subjectType: "ORG", subjectId: summary.target, payload: { tick: summary.tick, ringkasan: summary.summary, mode: summary.mode ?? "INSTITUSI", durasi: summary.durationMs } });
  await db.civKV.upsert({
    where: { key: KV_LAST_TICK },
    create: { key: KV_LAST_TICK, value: JSON.stringify(summary) },
    update: { value: JSON.stringify(summary) },
  });

  void seed;
  return summary;
}

/** Riwayat denyut untuk UI. */
export async function recentTicks(limit = 20): Promise<TickSummary[]> {
  const rows = await db.civEvent.findMany({ where: { type: EVENT_TYPES.HEARTBEAT }, orderBy: { seq: "desc" }, take: Math.min(limit, 60) });
  return rows.map((r) => {
    const p = safeParse(r.payload);
    return {
      tick: Number(p.tick ?? 0),
      target: r.subjectId,
      kind: "-",
      summary: String(p.ringkasan ?? ""),
      mode: String(p.mode ?? "INSTITUSI"),
      durationMs: Number(p.durasi ?? 0),
      at: r.createdAt.toISOString(),
    };
  });
}
