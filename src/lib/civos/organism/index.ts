// ORGANISM · index.ts — pintu masuk runtime (singleton per proses).

import { OrganismRuntime } from "./loop";
import { getLLMConfig } from "./llm";
import type { OrganismState } from "./types";

let runtime: OrganismRuntime | null = null;

export function getOrganismRuntime(): OrganismRuntime {
  if (!runtime) runtime = new OrganismRuntime();
  return runtime;
}

/** State lengkap + status LLM nyata (async). */
export async function getOrganismState(): Promise<OrganismState> {
  const rt = getOrganismRuntime();
  const st = rt.getState();
  const cfg = await getLLMConfig();
  st.llm = { mode: cfg.mode, baseUrl: cfg.baseUrl || undefined, model: cfg.model, keySet: Boolean(cfg.apiKey) };
  return st;
}
