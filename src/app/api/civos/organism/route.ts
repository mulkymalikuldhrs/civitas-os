// CIVITAS OS — organism/route.ts (ORGANISM RUNTIME API)
// GET  = state penuh organisme (DNA, world model, goals, decision, memory,
//        capability graph, gaps, mutasi A/B, populasi anak, imun, LLM).
// POST = kontrol operator TANPA workflow approval:
//        tick · pause · resume · kill · unkill · lock · unlock ·
//        mutate {level,hypothesis} · rollback {id} · acquire {capabilityId} ·
//        child {op,id,role} · llm_config {baseUrl,apiKey,model,enabled}
// Semua respons jujur; kegagalan dilaporkan apa adanya.

import { NextResponse } from "next/server";
import { getOrganismState, getOrganismRuntime } from "@/lib/civos/organism";
import { setConfigValue, getConfigValue } from "@/lib/civos/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await getOrganismState();
    return NextResponse.json({ ok: true, ...state });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "state organism gagal" }, { status: 500 });
  }
}

interface Body {
  action?: string;
  force?: boolean;
  level?: string;
  hypothesis?: string;
  id?: string;
  capabilityId?: string;
  role?: string;
  op?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  enabled?: boolean;
}

const MUT_LEVELS = new Set(["L1_PARAMETER", "L2_STRATEGY", "L3_WORKFLOW", "L4_CAPABILITY", "L5_ORGANIZATION"]);

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const rt = getOrganismRuntime();
    const a = body.action ?? "";

    switch (a) {
      case "tick": {
        const r = await rt.tick(Boolean(body.force));
        return NextResponse.json({ ok: true, ...r });
      }
      case "pause": return NextResponse.json({ ok: true, phase: rt.pause(body.hypothesis ?? "via API") });
      case "resume": return NextResponse.json({ ok: true, phase: rt.resume(body.hypothesis ?? "via API") });
      case "kill": return NextResponse.json({ ok: true, phase: rt.kill() });
      case "unkill": return NextResponse.json({ ok: true, phase: rt.unkill() });
      case "lock": return NextResponse.json({ ok: true, phase: rt.lock(body.hypothesis ?? "via API") });
      case "unlock": return NextResponse.json({ ok: true, phase: rt.unlock() });
      case "mutate": {
        const level = body.level ?? "L1_PARAMETER";
        if (!MUT_LEVELS.has(level)) return NextResponse.json({ ok: false, error: `level tidak valid: ${level}` }, { status: 400 });
        const note = await rt.mutate(level as "L1_PARAMETER", body.hypothesis ?? "");
        return NextResponse.json({ ok: true, note });
      }
      case "rollback": {
        if (!body.id) return NextResponse.json({ ok: false, error: "butuh id mutasi" }, { status: 400 });
        return NextResponse.json({ ok: true, note: rt.rollback(body.id) });
      }
      case "acquire": {
        if (!body.capabilityId) return NextResponse.json({ ok: false, error: "butuh capabilityId" }, { status: 400 });
        return NextResponse.json({ ok: true, note: await rt.acquire(body.capabilityId) });
      }
      case "child": {
        const note = await rt.childrenOps(body.op ?? "reap", body.op === "spawn" ? (body.role ?? "observer") : body.id);
        return NextResponse.json({ ok: true, note });
      }
      case "llm_config": {
        // custom base url + api key + model — bisa diatur lewat UI (mandat #4)
        const results: string[] = [];
        if (typeof body.baseUrl === "string") results.push(`baseUrl: ${(await setConfigValue("llm.baseUrl", body.baseUrl.trim())).ok}`);
        if (typeof body.apiKey === "string" && body.apiKey.trim() !== "") results.push(`apiKey: ${(await setConfigValue("llm.apiKey", body.apiKey.trim())).ok}`);
        if (typeof body.model === "string" && body.model.trim() !== "") results.push(`model: ${(await setConfigValue("llm.model", body.model.trim())).ok}`);
        if (typeof body.enabled === "boolean") results.push(`enabled: ${(await setConfigValue("llm.enabled", body.enabled ? "true" : "false")).ok}`);
        const keySet = (await getConfigValue("llm.apiKey")) !== "";
        const baseUrl = (await getConfigValue("llm.baseUrl")) || "";
        return NextResponse.json({ ok: true, note: `disimpan: ${results.join(", ") || "tidak ada perubahan"}`, llm: { baseUrl: baseUrl || undefined, keySet, mode: baseUrl && keySet ? "REMOTE" : "HEURISTIC" } });
      }
      default:
        return NextResponse.json({ ok: false, error: `action tidak dikenal: ${a}` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "aksi organism gagal" }, { status: 500 });
  }
}
