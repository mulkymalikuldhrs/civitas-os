"use client";
// CIVITAS OS — EventsView: event immutable + riwayat denyut.

import { MCLog, MCPanel, MCSectionTitle } from "../mcui";
import { useCiv } from "../McShell";

export default function EventsView() {
  const { s } = useCiv();
  const events = s?.events ?? [];
  const ticks = s?.ticks ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <MCPanel dark>
        <MCSectionTitle>EVENT BUS IMMUTABLE (tulis sekali, tak pernah diubah)</MCSectionTitle>
        <MCLog
          lines={events.map((e) => ({
            text: `#${e.seq} ${e.type} — ${e.subject}: ${JSON.stringify(e.payload).slice(0, 120)}`,
            tone: e.type.includes("FAILED") || e.type.includes("VIOLATION") ? "err" : e.type.includes("REVENUE") || e.type.includes("CENSUS") ? "ok" : "info",
          }))}
          className="!max-h-[520px]"
        />
      </MCPanel>
      <MCPanel dark>
        <MCSectionTitle>RIWAYAT DENYUT OTONOM</MCSectionTitle>
        <MCLog
          lines={ticks.map((t) => ({
            text: `tick ${t.tick} [${t.kind}] ${t.target}: ${t.summary}${t.village ? ` · DESA: ${t.village}` : ""} (${t.durationMs ?? 0}ms)`,
            tone: t.mode === "REFLEX" ? "warn" : "info",
          }))}
          className="!max-h-[520px]"
        />
      </MCPanel>
    </div>
  );
}
