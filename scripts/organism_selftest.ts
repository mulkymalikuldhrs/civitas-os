// organism_selftest.ts — UJI EKSEKUSI NYATA seluruh pipeline organisme.
// Bukan mock-test: menjalankan mutation engine (git worktree + benchmark A/B),
// agent spawner (proses bun sungguhan + PID), capability build (tulis+eksekusi
// modul), dan satu tick loop penuh. Setiap langkah cetak bukti.

export {}; // penanda module (lesson F-01)

process.on("unhandledRejection", (r) => { process.stderr.write(`[selftest] unhandledRejection: ${String(r).slice(0, 200)}\n`); });

async function main(): Promise<void> {
  console.log("=== ORGANISM SELFTEST (bukti eksekusi nyata) ===\n");

  // 1. DNA
  const { getOrganismRuntime } = await import("../src/lib/civos/organism/index");
  const { loadOrBirthDNA, genomeHash } = await import("../src/lib/civos/organism/dna");
  const { dna, newborn } = loadOrBirthDNA();
  console.log(`[1] DNA: id=${dna.core.id} name=${dna.core.name} newborn=${newborn} genomeHash=${genomeHash(dna)}`);
  console.log(`    immune: timeout=${dna.immune.timeoutMs}ms recursion=${dna.immune.maxRecursion} retry=${dna.immune.maxRetries} rss=${dna.immune.maxMemoryMb}MB mem=${dna.immune.maxMemoryEntries} net=${dna.immune.networkAllowlist.length} host tools=${Object.keys(dna.immune.toolPermissions).length}`);

  const rt = getOrganismRuntime();

  // 2. MUTATION A/B penuh (worktree sandbox + benchmark)
  console.log("\n[2] MUTATION L1 — propose → sandbox(worktree) → patch B → benchmark A/B → verdict");
  const m = await rt.mutate("L1_PARAMETER", "");
  console.log(`    → ${m}`);

  // 3. SPAWN child nyata
  console.log("\n[3] SPAWNER — proses anak sungguhan");
  const childRes = await rt.childrenOps("spawn", "observer");
  console.log(`    → ${childRes}`);
  await new Promise((r) => setTimeout(r, 3500));
  const state = rt.getState();
  for (const c of state.children.slice(-2)) {
    console.log(`    child ${c.id} status=${c.status} pid=${c.pid} heartbeat=${c.lastHeartbeat ?? "-"} cycles=${c.cycles ?? "-"}`);
  }

  // 4. CAPABILITY BUILD nyata
  console.log("\n[4] CAPABILITY — build text.hash (tulis modul + eksekusi + verifikasi)");
  const cap = await rt.acquire("text.hash");
  console.log(`    → ${cap}`);

  // 5. TICK penuh
  console.log("\n[5] TICK — observe → goals → decide → act → evaluate → reflect");
  const t = await rt.tick(true);
  console.log(`    → ran=${t.ran} cycle=${t.cycle} note=${t.note.slice(0, 220)}`);

  // 6. STATE ringkas
  const s2 = rt.getState();
  console.log("\n[6] STATE:");
  console.log(`    phase=${s2.loop.phase} cycle=${s2.loop.cycle} goals=${s2.goals.length} capabilities=${s2.capabilities.filter((c) => c.status === "AVAILABLE").length}/${s2.capabilities.length}`);
  console.log(`    mutations terakhir: ${s2.mutations.slice(0, 2).map((mm) => `${mm.id}:${mm.status}`).join(", ") || "-"}`);
  console.log(`    world.resources: cpu=${s2.world.resources?.cpuCount} rss=${s2.world.resources?.rssMb}MB disk=${s2.world.resources?.diskFreeMb}MB`);
  console.log(`    world.infra: ${Object.entries(s2.world.infrastructure ?? {}).map(([k, v]) => `${k}=${Math.round(v.health)}`).join(" ")}`);
  console.log(`    epistemic: known=${s2.world.epistemic?.known.length} unknown=${s2.world.epistemic?.unknown.length} assumptions=${s2.world.epistemic?.assumptions.length} unverified=${s2.world.epistemic?.unverified.length}`);
  console.log(`    immuneEvents=${s2.immuneEvents.length} memory=${s2.memory.length} children=${s2.children.length}`);

  console.log("\n=== SELFTEST SELESAI ===");
}

main().catch((e) => { console.error("SELFTEST_ERROR:", e); process.exit(1); });
