// FLYBRAIN ORGANISM — creatures.ts
// Katalog 6 creature awal BIOSFER (11_AUTONOMOUS_ORGANISM.md §3.1).
// MURNI DATA (importable dari server untuk validasi creatureId/role di API) —
// tanpa import browser/server, ikon hanya nama string lucide.

import type { OrganId } from "./loops";

export type CreatureId = "prt" | "tradio" | "scriba" | "lumen" | "cresca" | "fabro";
export type CreatureRole = "guardian" | "trader" | "writer" | "researcher" | "farmer" | "builder";

export interface CreatureMeta {
  id: CreatureId;
  name: string;
  species: string;
  role: CreatureRole;
  /** Organ v1.0 yang memberi mandat penalaran (pemetaan creature → organ). */
  organ: OrganId;
  /** Deskripsi Indonesia untuk inspektor & katalog MCP. */
  description: string;
  /** Refleks offline deterministik (warisan civilization-work upstream). */
  reflex: string;
  /** Otonomi LLM yang boleh dia lakukan saat mandat terbuka. */
  llm: string;
  color: string; // warna aksen tema laboratorium
  icon: string; // nama ikon lucide (tanpa komponen — file ini murni data)
  traits: string[]; // genom awal
}

/** 6 spesies awal — peran warisan `civilization-work` upstream, tubuhnya FLYBRAIN. */
export const CREATURES: CreatureMeta[] = [
  {
    id: "prt",
    name: "prt",
    species: "Lalat (guardian)",
    role: "guardian",
    organ: "guardian",
    description:
      "Lalat penjaga platform — operator otonom v1.0. Mematrol vital sarang, menjaga vault, dan membangunkan creature yang tidur.",
    reflex: "patroli vital (statistik vault, kwitansi, gerbang)",
    llm: "heartbeat organ guardian: heal / tune / report",
    color: "#4ade80",
    icon: "Bug",
    traits: ["penjaga", "rajin", "jujur", "nol-penyimpanan"],
  },
  {
    id: "tradio",
    name: "Tradio",
    species: "Trader",
    role: "trader",
    organ: "merchant",
    description:
      "Pembaca sinyal pasar BIOSFER. Di upstream-nya dia mengais data Polygon/AlphaVantage; di sini dia menilai portofolio SIMULASI lokal dengan quant engine — dan mengatakannya dengan jujur.",
    reflex: "skoring simulasi random-walk via quant engine",
    llm: "keputusan posisi (HOLD/akumulasi) dengan alasan",
    color: "#fbbf24",
    icon: "TrendingUp",
    traits: ["disiplin", "pembilang-risiko", "anti-hiperbola"],
  },
  {
    id: "scriba",
    name: "Scriba",
    species: "Writer",
    role: "writer",
    organ: "envoy",
    description:
      "Jurulis ekosistem. Menyusun laporan dan catatan keadaan biosfer dari ledger lokal — tidak pernah mengarang data yang tidak dia baca.",
    reflex: "laporan keadaan dari ledger lokal",
    llm: "draft konten/laporan ekosistem",
    color: "#38bdf8",
    icon: "PenLine",
    traits: ["teliti", "naratif", "transparan"],
  },
  {
    id: "lumen",
    name: "Lumen",
    species: "Researcher",
    role: "researcher",
    organ: "scout",
    description:
      "Peneliti memori. Mengindeks statistik vault, menemukan pola agregat, dan mengusulkan asosiasi — tanpa membongkar isi memori pemilik.",
    reflex: "indeksasi memori + temuan pola agregat",
    llm: "asosiasi pola lintas statistik",
    color: "#a78bfa",
    icon: "Microscope",
    traits: ["analitis", "penasaran", "hormat-privasi"],
  },
  {
    id: "cresca",
    name: "Cresca",
    species: "Farmer",
    role: "farmer",
    organ: "merchant",
    description:
      "Petani peluang. Menanam dan memanen checklist pertumbuhan (ekspor rutin, validasi kwitansi, memori baru) — satu musim satu panen.",
    reflex: "checklist panen peluang (tick deterministik)",
    llm: "prioritas peluang pertumbuhan",
    color: "#34d399",
    icon: "Sprout",
    traits: ["sabar", "metodis", "berkelanjutan"],
  },
  {
    id: "fabro",
    name: "Fabro",
    species: "Builder",
    role: "builder",
    organ: "scout",
    description:
      "Pembangun tool. Merakit blueprint alat kecil dalam batas aman (evolusi terbatas: menyetel parameternya, tidak menulis ulang konstitusi).",
    reflex: "blueprint tool kecil dari kebutuhan vault",
    llm: "keputusan build + kristalisasi skill",
    color: "#f472b6",
    icon: "Hammer",
    traits: ["praktis", "hemat", "dalam-batas"],
  },
];

export const CREATURE_IDS: CreatureId[] = CREATURES.map((c) => c.id);

export function isCreatureId(x: unknown): x is CreatureId {
  return typeof x === "string" && (CREATURE_IDS as string[]).includes(x);
}

export function creatureMeta(id: string): CreatureMeta {
  return CREATURES.find((c) => c.id === id) ?? CREATURES[0];
}

/** Pemetaan role creature → organ v1.0 (untuk scope-grant). */
export function roleOrgan(role: CreatureRole): OrganId {
  switch (role) {
    case "guardian":
      return "guardian";
    case "trader":
    case "farmer":
      return "merchant";
    case "writer":
      return "envoy";
    case "researcher":
    case "builder":
      return "scout";
  }
}
