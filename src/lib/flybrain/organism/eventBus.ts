// FLYBRAIN ORGANISM — eventBus.ts
// Bus kejadian biosfer lokal (port dari gitlab src/colony/core/EventBus.ts, dipadatkan).
// Berjalan di memori klien; riwayat dibatasi 200 kejadian (konstitusi hukum 6: hemat).
// MURNI TypeScript — tanpa import browser/server; dipakai engine & view.

export type BiosferEventType =
  | "spawn" // creature lahir / dimuat pertama kali
  | "sleep" // energi habis → creature tidur
  | "wake" // dibangunkan prt / immune / reflect
  | "decide" // keputusan diambil (menalar atau refleks)
  | "act" // aksi dieksekusi klien
  | "ledger" // jejak ditulis ke vault lokal
  | "quant" // quant tick selesai (simulasi lokal)
  | "death" // creature mati (dihentikan immune)
  | "reflect"; // self-reflect verdict

export const BIOSFER_EVENT_TYPES: BiosferEventType[] = [
  "spawn",
  "sleep",
  "wake",
  "decide",
  "act",
  "ledger",
  "quant",
  "death",
  "reflect",
];

export interface BiosferEvent {
  id: string;
  at: string; // ISO
  type: BiosferEventType;
  creatureId: string | null;
  message: string;
  /** Label jujur mode penalaran saat kejadian itu terjadi (jika relevan). */
  mode?: "menalar" | "refleks";
  meta?: Record<string, unknown>;
}

export type BiosferHandler = (e: BiosferEvent) => void;

const MAX_HISTORY = 200;

export class BiosferBus {
  private subscribers = new Map<BiosferEventType | "*", Set<BiosferHandler>>();
  private history: BiosferEvent[] = [];

  /** Berlangganan; type "*" menerima semua. Return = fungsi unsubscribe. */
  subscribe(type: BiosferEventType | "*", handler: BiosferHandler): () => void {
    if (!this.subscribers.has(type)) this.subscribers.set(type, new Set());
    this.subscribers.get(type)!.add(handler);
    return () => {
      this.subscribers.get(type)?.delete(handler);
    };
  }

  /** Emit kejadian: masuk riwayat (maks 200) lalu disebarkan sinkron. */
  emit(type: BiosferEventType, message: string, opts?: { creatureId?: string | null; mode?: "menalar" | "refleks"; meta?: Record<string, unknown> }): BiosferEvent {
    const ev: BiosferEvent = {
      id: `ev_${Date.now().toString(36)}${Math.floor(Math.random() * 0xffff).toString(36)}`,
      at: new Date().toISOString(),
      type,
      creatureId: opts?.creatureId ?? null,
      message: message.slice(0, 300),
      ...(opts?.mode ? { mode: opts.mode } : {}),
      ...(opts?.meta ? { meta: opts.meta } : {}),
    };
    this.history.push(ev);
    if (this.history.length > MAX_HISTORY) this.history = this.history.slice(-MAX_HISTORY);

    const handlers = [...(this.subscribers.get(type) ?? []), ...(this.subscribers.get("*") ?? [])];
    for (const h of handlers) {
      try {
        h(ev);
      } catch {
        /* handler rusak tidak boleh menjatuhkan bus (konstitusi hukum 6) */
      }
    }
    return ev;
  }

  /** Riwayat terbaru (default 50, maks 200). Urutan: terbaru dulu. */
  recent(limit = 50): BiosferEvent[] {
    return [...this.history].reverse().slice(0, Math.min(limit, MAX_HISTORY));
  }

  /** Riwayat terfilter per type. */
  byType(type: BiosferEventType, limit = 50): BiosferEvent[] {
    return this.recent(MAX_HISTORY).filter((e) => e.type === type).slice(0, limit);
  }

  get size(): number {
    return this.history.length;
  }

  clear(): void {
    this.history = [];
  }
}

/** Bus tunggal biosfer (satu proses klien = satu biosfer). */
export const eventBus = new BiosferBus();

/** Warna aksen per tipe kejadian (tema laboratorium malam). */
export const EVENT_COLORS: Record<BiosferEventType, string> = {
  spawn: "#4ade80",
  sleep: "#94a3b8",
  wake: "#fbbf24",
  decide: "#38bdf8",
  act: "#a78bfa",
  ledger: "#6ee7a0",
  quant: "#f472b6",
  death: "#f87171",
  reflect: "#facc15",
};
