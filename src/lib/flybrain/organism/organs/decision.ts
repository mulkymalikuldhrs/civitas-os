// FLYBRAIN ORGANISM — organs/decision.ts
// PORT dari upstream gh `decision/index.js` + gitlab jeumpa-brain. Adaptasi:
// penalar = panggilan klien ke /api/organism/heartbeat (LLM serverless stateless);
// bila gagal → pemanggil jatuh ke refleks creature (creature.ts).
// MURNI TypeScript di sisi logika; fetch hanya dijalankan dari klien.

import type { CreatureState, CreatureReflexContext } from "../creature";
import { creatureReflex } from "../creature";
import type { OrganId } from "../loops";

/** Keputusan mentah dari penalar (kontrak sama dengan brain.PrtDecision). */
export interface CreatureDecision {
  organ: string;
  aware: string;
  interpret: string;
  decision: string;
  action: { type: string; target: string; payload: string | null; reason: string };
  remember: string;
}

export interface DecisionResult {
  decision: CreatureDecision | null;
  mode: "menalar" | "refleks";
  model: string;
  latencyMs: number;
  error?: string;
}

/**
 * Minta keputusan LLM untuk satu creature (SADAR→TAFSIR→PUTUSKAN dari sisi server;
 * BERTINDAK→INGAT dieksekusi klien). Timeout ketat; gagal → null (pemanggil pakai refleks).
 */
export async function requestDecision(input: {
  creature: CreatureState;
  organ: OrganId;
  sensePacket: string;
  tier: string;
  timeoutMs?: number;
}): Promise<{ decision: CreatureDecision | null; model: string; latencyMs: number; error?: string }> {
  const t0 = Date.now();
  const timeout = input.timeoutMs ?? 30_000;
  try {
    const res = await fetch("/api/organism/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organ: input.organ,
        creatureId: input.creature.id,
        role: input.creature.role,
        sensePacket: input.sensePacket,
        tier: input.tier,
        ts: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(timeout),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      decision?: CreatureDecision;
      model?: string;
      latencyMs?: number;
      error?: string;
    };
    if (!res.ok || !data.ok || !data.decision) {
      return { decision: null, model: data.model ?? "z-ai-glm", latencyMs: Date.now() - t0, error: data.error ?? `HTTP ${res.status}` };
    }
    return {
      decision: data.decision,
      model: data.model ?? "z-ai-glm",
      latencyMs: typeof data.latencyMs === "number" ? data.latencyMs : Date.now() - t0,
    };
  } catch (e) {
    return { decision: null, model: "z-ai-glm", latencyMs: Date.now() - t0, error: e instanceof Error ? e.message : "jaringan gagal" };
  }
}

/** Refleks offline: bungkus creatureReflex ke kontrak DecisionResult. */
export function reflexDecision(creature: CreatureState, ctx: CreatureReflexContext): DecisionResult {
  const r = creatureReflex(creature, ctx);
  return {
    decision: {
      organ: creature.role,
      aware: r.phases.sadar,
      interpret: r.phases.tafsir,
      decision: r.phases.putuskan,
      action: r.action,
      remember: r.remember,
    },
    mode: "refleks",
    model: "refleks-lokal",
    latencyMs: 0,
  };
}
