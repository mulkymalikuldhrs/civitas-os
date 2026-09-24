// CIVITAS OS — civitas_selflife_tick.ts
// Satu detak kehidupan (watchdog server + denyut + backup/sync jadwal) — dijalankan
// daemon via `bun scripts/civitas_selflife_tick.ts` sehingga kehidupan peradaban TIDAK
// bergantung pada web app. Output JSON ringkas ke stdout untuk log daemon.
import { selfLifeTick } from "../src/lib/civos/selflife";

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
