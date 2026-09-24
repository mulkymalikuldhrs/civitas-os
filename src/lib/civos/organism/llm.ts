// ORGANISM · llm.ts — Otak bahasa organisme. FREE-FIRST (mandat #13):
// jalur pertama = HEURISTIC (deterministik, gratis, tanpa jaringan) —
// organisme hidup penuh tanpa LLM berbayar. Jalur kedua (opsional, hanya bila
// user isi config lewat UI): base URL OpenAI-compatible + API key + model.
// Panggilan remote tetap melewati imun (allowlist tak berlaku utk endpoint
// user — user yang menentukan; tapi timeout tetap enforced).

import { getConfigValue } from "../config";
import { safeFetch } from "./immune";
import type { ImmuneLimits, WorldModel } from "./types";

export interface LLMConfig {
  mode: "HEURISTIC" | "REMOTE";
  baseUrl: string;
  apiKey: string;
  model: string;
}

export async function getLLMConfig(): Promise<LLMConfig> {
  const [baseUrl, apiKey, model, enabled] = await Promise.all([
    getConfigValue("llm.baseUrl"),
    getConfigValue("llm.apiKey"),
    getConfigValue("llm.model"),
    getConfigValue("llm.enabled"),
  ]);
  const remote = String(enabled) === "true";
  if (remote && baseUrl && apiKey) {
    return { mode: "REMOTE", baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, model: model || "gpt-4o-mini" };
  }
  return { mode: "HEURISTIC", baseUrl: "", apiKey: "", model: "heuristic-v1" };
}

/** Panggil LLM: REMOTE bila dikonfigurasi, selain itu HEURISTIC lokal. */
export async function think(
  prompt: string,
  world: WorldModel | null,
  limits: ImmuneLimits,
): Promise<{ mode: "HEURISTIC" | "REMOTE"; text: string }> {
  const cfg = await getLLMConfig();
  if (cfg.mode === "REMOTE") {
    try {
      const res = await safeFetch(`${cfg.baseUrl}/chat/completions`, limits, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: "system", content: "Kamu adalah organisme digital CIVITAS OS. Jawab ringkas, jujur, berbasis data world model. Bahasa: Indonesia." },
            { role: "user", content: prompt },
          ],
          max_tokens: 400,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = data.choices?.[0]?.message?.content;
        if (text) return { mode: "REMOTE", text };
      }
      return { mode: "HEURISTIC", text: `${heuristic(prompt, world)} [fallback: endpoint remote status ${res.status}]` };
    } catch (e) {
      return { mode: "HEURISTIC", text: `${heuristic(prompt, world)} [fallback: remote gagal: ${(e as Error).message}]` };
    }
  }
  return { mode: "HEURISTIC", text: heuristic(prompt, world) };
}

/** Heuristic brain: komposisi laporan deterministik dari world model. */
function heuristic(prompt: string, world: WorldModel | null): string {
  if (!world) return "World model belum terbangun — jalankan siklus observe dulu.";
  const infra = Object.entries(world.infrastructure)
    .map(([k, v]) => `${k}=${Math.round(v.health)}`)
    .join(" ");
  const risks = world.risks.length ? world.risks.map((r) => `${r.key}(${r.level})`).join(", ") : "tidak ada";
  const unknown = world.epistemic.unknown.map((u) => u.key).join(", ") || "tidak ada";
  return [
    `[HEURISTIC] ${prompt.slice(0, 120)}`,
    `Sumber daya: ${world.resources.cpuCount} core, RSS ${world.resources.rssMb}MB, disk ${world.resources.diskFreeMb}MB.`,
    `Infrastruktur: ${infra}.`,
    `Risiko: ${risks}.`,
    `Unknown: ${unknown}.`,
    `Ekonomi: ${world.economy.actionsDone} aksi tercatat, biaya siklus rata-rata ${world.economy.cycleCostMs}ms.`,
  ].join(" ");
}
