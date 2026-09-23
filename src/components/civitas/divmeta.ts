"use client";
// Peta konstanta DIVISION_META untuk klien (salinan label charter kernel).

export const DIVISION_META: Record<string, { label: string; desc: string; tools: string[]; artifactKind: string; icon: string }> = {
  GENERAL: { label: "Warga Umum", desc: "pekerjaan desa sehari-hari", tools: [], artifactKind: "REPORT", icon: "Users" },
  CODER: { label: "Pemrogram", desc: "menulis & merawat kode peradaban", tools: ["code_write"], artifactKind: "CODE", icon: "Code2" },
  DEV: { label: "Pengembang", desc: "merancang produk & spesifikasi", tools: ["spec_write"], artifactKind: "SPEC", icon: "GitBranch" },
  BUILDER: { label: "Pembangun", desc: "membangun struktur dunia", tools: ["build_plan"], artifactKind: "BLUEPRINT", icon: "Hammer" },
  MILITARY: { label: "Garda", desc: "pertahanan & patroli desa", tools: ["patrol_report"], artifactKind: "PATROL", icon: "Shield" },
  ENGINEER: { label: "Insinyur", desc: "infrastruktur & utilitas desa", tools: ["build_plan"], artifactKind: "BLUEPRINT", icon: "Wrench" },
  MINER: { label: "Penambang", desc: "menambang sumber daya ke pasar", tools: ["mine_route"], artifactKind: "MINE_YIELD", icon: "Pickaxe" },
  NETRUNNER: { label: "Penyambung Internet", desc: "riset dunia nyata via internet", tools: ["web_search", "page_reader", "mcp_call"], artifactKind: "RESEARCH", icon: "Globe" },
  TOOLSMITH: { label: "Pengrajin Alat", desc: "menguji & mengorkestrasi semua tool", tools: ["web_search", "page_reader", "code_write", "spec_write", "build_plan", "mine_route", "patrol_report", "mcp_call"], artifactKind: "REPORT", icon: "Cog" },
};

export function divisionMeta(key: string) {
  return DIVISION_META[key] ?? DIVISION_META.GENERAL;
}
