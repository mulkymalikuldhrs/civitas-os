// organism_tick.ts — runner satu siklus organisme (dipanggil daemon / cron / CLI).
// Jika organism module gagal import/crash → laporan jujur + exit 0 (jangan
// bunuh daemon; F-01 lesson: satu subsystem tidak boleh menjatuhkan yang lain).

export {}; // penanda module (lesson F-01)

process.on("unhandledRejection", (r) => {
  process.stderr.write(`[org-tick] unhandledRejection: ${String(r).slice(0, 200)}\n`);
});
process.on("uncaughtException", (e) => {
  process.stderr.write(`[org-tick] uncaughtException: ${String(e).slice(0, 200)}\n`);
  process.exitCode = 0;
});

try {
  const { getOrganismRuntime } = await import("../src/lib/civos/organism/index");
  const rt = getOrganismRuntime();
  const res = await rt.tick(false); // hormati PAUSED/LOCKED/KILLED
  console.log(JSON.stringify({ at: new Date().toISOString(), tick: "ORGANISM", ...res }));
} catch (e) {
  console.log(JSON.stringify({ at: new Date().toISOString(), tick: "ORGANISM_CRASHED", error: String(e).slice(0, 200) }));
  process.exitCode = 0;
}
