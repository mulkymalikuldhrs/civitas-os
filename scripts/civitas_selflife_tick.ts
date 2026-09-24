// CIVITAS OS — civitas_selflife_tick.ts
// Satu detak kehidupan (watchdog server + denyut + backup/sync jadwal) — dijalankan
// daemon via `bun scripts/civitas_selflife_tick.ts` sehingga kehidupan peradaban TIDAK
// bergantung pada web app. Output JSON ringkas ke stdout untuk log daemon.
//
// F-01 FIX (review 16-h1): tick TIDAK BOLEH crash — apapun yang terjadi di dalam
// selfLifeTick, wrapper ini menangkapnya dan selalu mencetak JSON jujur ke stdout
// (daemon log tidak pernah lagi berakhir dengan crash-footer Bun).
export {}; // penanda module — await top-level sah untuk tsc

// F-01 FIX lanjutan: penolakan tak tertangani (mis. dari socket mineflayer) TIDAK
// boleh mencetak crash-footer Bun atau membunuh tick — dicatat jujur ke stderr.
process.on("unhandledRejection", (r) => {
  process.stderr.write(`[tick] unhandledRejection: ${String(r).slice(0, 200)}\n`);
});
process.on("uncaughtException", (e) => {
  process.stderr.write(`[tick] uncaughtException: ${e instanceof Error ? e.message : String(e).slice(0, 200)}\n`);
});

try {
  const { selfLifeTick } = await import("../src/lib/civos/selflife");
  const r = await selfLifeTick();
  console.log(JSON.stringify({
    at: r.at,
    revived: r.revived,
    pulse: r.pulse ? `${r.pulse.target}: ${r.pulse.summary.slice(0, 100)}` : null,
    backupRan: r.backupRan,
    backupOk: r.backup?.ok ?? null,
    syncRan: r.syncRan,
    syncOk: r.sync?.ok ?? null,
    notes: r.notes,
  }));
} catch (e) {
  // Jujur: kegagalan tick dilaporkan sebagai JSON error — bukan crash proses.
  console.log(JSON.stringify({
    at: new Date().toISOString(),
    tick: "CRASHED",
    error: e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 300) : String(e).slice(0, 300),
    note: "tick gagal total — daemon tetap hidup dan akan mencoba lagi",
  }));
  process.exitCode = 0; // daemon loop tetap jalan; kegagalan tercatat di log
}

// ── ORGANISM RUNTIME (mandat 38-poin): denyut organisme mengikuti daemon ──
// Gagal organisme TIDAK boleh menggagalkan selflife tick (isolasi subsystem).
try {
  const { getOrganismRuntime } = await import("../src/lib/civos/organism/index");
  const org = await getOrganismRuntime().tick(false); // hormati PAUSED/LOCKED/KILLED
  console.log(JSON.stringify({ at: new Date().toISOString(), organism: org }));
} catch (e) {
  console.log(JSON.stringify({
    at: new Date().toISOString(),
    organism: "CRASHED",
    error: e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : String(e).slice(0, 200),
  }));
}
