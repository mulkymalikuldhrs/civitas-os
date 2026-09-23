// CIVITAS OS — guild_probe.ts
// PROBE SLICE 9 (GUILD & TOOLFORGE): bukti runtime bahwa warga guild bekerja
// NYATA — upah WAGE + artefak per divisi + direktif tubuh + charter ditolak-kan.
// Jalankan: bunx tsx scripts/guild_probe.ts  (atau bun run scripts/guild_probe.ts)
// Probe = harness kernel: menulis binding kerja untuk pengujian, TIDAK melewati
// policy eksekusi (semua keputusan tetap lewat villagePulseNext).

import { db } from "../src/lib/db";
import { villagePulseNext } from "../src/lib/civos/village";
import { invokeTool } from "../src/lib/civos/tools";
import { accountBalance } from "../src/lib/civos/ledger";
import { divisionMeta, DIVISIONS } from "../src/lib/civos/types";

async function main() {
  console.log("=== GUILD PROBE — SLICE 9 ===");

  // 1. Pilih perusahaan hidup berkas terbesar (kernel admin untuk pengujian).
  const orgs = await db.civOrg.findMany({ where: { kind: "COMPANY", lifecycle: { notIn: ["BANKRUPT", "DISSOLVED"] } }, include: { accounts: true } });
  let funded: { id: string; code: string } | null = null;
  let best = -1;
  for (const o of orgs) {
    const ops = o.accounts.find((a) => a.kind === "OPERATING");
    if (!ops) continue;
    const bal = await accountBalance(ops.id);
    if (bal > best) { best = bal; funded = { id: o.id, code: o.code }; }
  }
  if (!funded) throw new Error("tidak ada perusahaan hidup — seed dulu");
  console.log(`perusahaan dana: ${funded.code} (kas ${best})`);

  // 2. Rebind 8 warga guild ke perusahaan berdana (binding kerja untuk pengujian).
  const villagers = await db.civVillager.findMany({ where: { status: "ACTIVE", division: { not: "GENERAL" } }, orderBy: { code: "asc" } });
  for (const v of villagers) {
    await db.civVillager.update({ where: { id: v.id }, data: { workOrgId: funded!.id } });
  }
  console.log(`rebind ${villagers.length} warga guild → ${funded.code}`);

  // 3. Jalankan denyut warga 8x (SATU warga per denyut — konstitusi).
  for (let i = 0; i < villagers.length; i++) {
    const r = await villagePulseNext(true);
    console.log(`denyut#${i + 1}: ${r.code ?? "-"} [${r.action ?? "-"}] ${r.summary.slice(0, 150)}`);
  }

  // 4. Charter: warga umum & saling silang harus DITOLAK.
  const v0 = await db.civVillager.findFirst({ where: { code: "VIL-0015" } });
  if (v0) {
    const denied = await invokeTool({ type: "VILLAGER", id: v0.id, code: v0.code, name: v0.name, division: v0.division, mcCoords: v0.mcCoords }, "code_write", {});
    console.log(`charter test (NETRUNNER→code_write): ${denied.status} — ${denied.note.slice(0, 90)}`);
    const ghost = await invokeTool({ type: "VILLAGER", id: v0.id, code: v0.code, name: v0.name, division: v0.division }, "hack_bank", {});
    console.log(`ghost tool test (hack_bank): ${ghost.status} — ${ghost.note.slice(0, 90)}`);
  }

  // 5. Ringkasan bukti.
  const [artifacts, calls, wages, dirs, market] = await Promise.all([
    db.civArtifact.findMany({ orderBy: { createdAt: "asc" }, select: { kind: true, division: true, title: true, tool: true } }),
    db.civToolCall.findMany({ orderBy: { seq: "asc" }, select: { tool: true, status: true, callerCode: true, latencyMs: true } }),
    db.civTxn.count({ where: { txType: "WAGE" } }),
    db.civVillagerDirective.findMany({ where: { kind: { in: ["BUILD", "PATROL", "MINE"] } }, select: { kind: true, status: true, origin: true } }),
    db.civMarketOffer.count({ where: { status: "OPEN" } }),
  ]);
  console.log("\n=== BUKTI SLICE 9 ===");
  console.log(`artefak: ${artifacts.length}`);
  for (const a of artifacts) console.log(`  [${a.kind}] (${a.division}) ${a.title} via ${a.tool ?? "-"}`);
  const statusMap: Record<string, number> = {};
  for (const c of calls) {
    const k = `${c.tool}/${c.status}`;
    statusMap[k] = (statusMap[k] ?? 0) + 1;
  }
  console.log(`tool calls: ${calls.length} — status: ${JSON.stringify(statusMap)}`);
  console.log(`WAGE tx total: ${wages}`);
  console.log(`direktif guild (BUILD/PATROL/MINE): ${dirs.length} — ${JSON.stringify(dirs.map((d) => `${d.kind}/${d.status}/${d.origin}`))}`);
  console.log(`pasar desa listing OPEN: ${market}`);
  const byDiv: Record<string, number> = {};
  for (const d of DIVISIONS) byDiv[d] = (await db.civVillager.count({ where: { status: "ACTIVE", division: d } }));
  console.log(`guild charter: ${JSON.stringify(byDiv)}`);
  for (const d of DIVISIONS) {
    if (byDiv[d] > 0 && divisionMeta(d).tools.length > 0) {
      const ok = artifacts.some((a) => a.division === d);
      console.log(`  guild ${d}: artefak ${ok ? "ADA (bukti kerja nyata)" : "BELUM ada"}`);
    }
  }
  await db.$disconnect();
}

main().catch((e) => { console.error("PROBE GAGAL:", e); process.exit(1); });
