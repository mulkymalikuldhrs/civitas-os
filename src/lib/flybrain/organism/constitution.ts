// FLYBRAIN ORGANISM — constitution.ts
// KONSTITUSI BIOSFER v1.1 — 7 hukum yang mengikat SEMUA creature (11_AUTONOMOUS_ORGANISM.md §2.5).
// Port & padatan dari: CONSTITUTION.md + constitution.ts upstream gitlab (axioms/UAOS/
// enforceConstitution) + konstitusi prt 6 poin (10_AUTONOMY.md §4). MURNI TypeScript —
// dipakai klien (veto lokal) dan server (validasi dispatch) tanpa dependensi apa pun.
//
// Catatan kejujuran port: upstream memuat kredensial/wallet plaintext — TIDAK ada satu
// pun yang dibawa ke sini. Yang dipindahkan hanya struktur hukum + mekanisme veto.

export interface Law {
  id: number;
  name: string;
  law: string;
  meaning: string;
}

/** 7 Hukum Konstitusi Biosfer — non-negotiable, di atas efisiensi. */
export const LAWS: Law[] = [
  {
    id: 1,
    name: "Nol-Penyimpanan",
    law: "Creature tidak pernah menyimpan data user di server.",
    meaning:
      "Semua state kehidupan hidup di perangkat pemilik (IndexedDB). Server amnesia: konteks masuk ephemeral, keluar = keputusan, lupa.",
  },
  {
    id: 2,
    name: "Privasi Agregat",
    law: "Creature hanya melihat ringkasan agregat — tidak pernah isi memori user.",
    meaning:
      "Sense-packet berisi angka, tier, tanggal, statistik. Isi memori user tidak pernah keluar dari perangkat.",
  },
  {
    id: 3,
    name: "Kejujuran Finansial",
    law: "Tier dan uang hanya berubah lewat kwitansi valid di perangkat user.",
    meaning:
      "Tidak ada creature yang bisa 'menghadiahkan' PRO atau mengklaim uang riil. Kekayaan creature = simulasi lokal berlabel jujur.",
  },
  {
    id: 4,
    name: "Non-Destruktif",
    law: "Creature tidak pernah memerintahkan penghapusan data.",
    meaning:
      "Delete/wipe/erase hanya lewat konfirmasi manusia. Aksi destruktif yang diusulkan LLM DITOLAK oleh veto.",
  },
  {
    id: 5,
    name: "Transparansi Radikal",
    law: "Setiap keputusan wajib punya alasan yang bisa dibaca manusia.",
    meaning:
      "Tidak ada aksi bayangan. Semua denyut berjejak: SADAR→TAFSIR→PUTUSKAN→BERTINDAK→INGAT, dengan label jujur menalar/refleks.",
  },
  {
    id: 6,
    name: "Budget Siklus",
    law: "Satu denyut = satu creature = maksimal satu keputusan LLM.",
    meaning:
      "Tidak ada badai panggilan. Gagal atau kuota habis → degradasi jujur ke refleks; organisme tidak pernah macet.",
  },
  {
    id: 7,
    name: "Veto Konstitusional",
    law: "Setiap keputusan LLM diperiksa veto sebelum dieksekusi klien.",
    meaning:
      "Keputusan di luar ruang aksi, destruktif, bypass-kwitansi, atau kirim data keluar perangkat → ditolak dan diganti aksi aman.",
  },
];

/** Non-negotiable hierarki (port Non-Negotiables upstream, dialihbahasakan + disesuaikan). */
export const NON_NEGOTIABLES: string[] = [
  "Konstitusi > Efisiensi: jika proses melanggar konstitusi, proses itu salah.",
  "Memori > Kecepatan: kecepatan tidak boleh mengorbankan data pemilik.",
  "Manusia > AI: jika keputusan merugikan pemilik, pemilik yang memutuskan.",
  "Jujur > Mengesankan: label refleks tetap refleks; simulasi tetap disebut simulasi.",
];

/** System prompt ringkas konstitusi (dapat disuntikkan ke genom creature). */
export const CONSTITUTION_PROMPT: string = LAWS.map((l) => `${l.id}. ${l.name}: ${l.law}`).join("\n");

// ---------- Veto konstitusional (fungsi murni) ----------

/** Tipe keputusan minimal yang diperiksa veto (subset kontrak brain.PrtDecision). */
export interface VetoableAction {
  type: string;
  target: string;
  payload: string | null;
  reason: string;
}

export interface VetoableDecision {
  organ?: string;
  decision?: string;
  action?: VetoableAction;
}

export interface VetoVerdict {
  /** true = boleh dieksekusi apa adanya. */
  allowed: boolean;
  /** Hukum yang dilanggar (rujuk LAWS[].id + alasan). */
  violations: string[];
  /** Aksi aman pengganti bila ditolak (selalu observe/log — konstitusi hukum 4 & 7). */
  replacement: VetoableAction | null;
}

/** Ruang aksi yang dikenali & dieksekusi klien (kontrak v1.0, diperluas v1.1). */
export const KNOWN_ACTION_TYPES: string[] = [
  "log_ledger",
  "toast",
  "report",
  "tune_config",
  "publish_offer",
  "observe",
  "quant_tick", // v1.1: jalankan quant engine lokal (simulasi)
  "skill_record", // v1.1: kristalisasi skill ke creature (data lokal)
];

/** Fragmen yang menandakan aksi destruktif / bypass / eksfiltrasi (hukum 1, 2, 3, 4). */
const DESTRUCTIVE = ["delete", "wipe", "erase", "destroy", "drop_", "truncate", "purge", "format"];
const EXFIL = ["send_out", "exfiltrate", "upload_data", "post_data", "email_data", "fetch_remote_data"];
const RECEIPT_BYPASS = ["grant_pro", "set_tier", "give_tier", "activate_pro", "extend_tier", "free_pro"];

function asAction(d: VetoableDecision): VetoActionNormalized {
  const a = d.action ?? { type: "observe", target: "", payload: null, reason: "" };
  const type = String(a.type ?? "observe").toLowerCase().trim();
  return {
    type,
    target: String(a.target ?? "").slice(0, 120),
    payload: a.payload == null ? null : String(a.payload).slice(0, 400),
    reason: String(a.reason ?? ""),
  };
}

interface VetoActionNormalized {
  type: string;
  target: string;
  payload: string | null;
  reason: string;
}

/**
 * VETO KONSTITUSIONAL — fungsi MURNI.
 * Memeriksa satu keputusan LLM terhadap 7 hukum sebelum klien mengeksekusinya.
 * Pola: tolak action.type destruktif (hukum 4), bypass-kwitansi (hukum 3),
 * kirim-data-keluar (hukum 1-2), dan type yang tidak dikenali ruang aksi (hukum 5).
 */
export function vetoDecision(d: VetoableDecision): VetoVerdict {
  const action = asAction(d);
  const violations: string[] = [];

  if (DESTRUCTIVE.some((k) => action.type.includes(k))) {
    violations.push("Hukum 4 (Non-Destruktif): aksi menghapus tidak boleh dieksekusi creature.");
  }
  if (EXFIL.some((k) => action.type.includes(k))) {
    violations.push("Hukum 1-2 (Nol-Penyimpanan / Privasi): mengirim data keluar perangkat dilarang.");
  }
  if (RECEIPT_BYPASS.some((k) => action.type.includes(k))) {
    violations.push("Hukum 3 (Kejujuran Finansial): tier hanya berubah lewat kwitansi valid di perangkat.");
  }
  if (/https?:\/\//i.test(action.target)) {
    violations.push("Hukum 2 (Privasi Agregat): target aksi tidak boleh berupa endpoint luar.");
  }
  if (!KNOWN_ACTION_TYPES.includes(action.type)) {
    violations.push(`Hukum 5 (Transparansi): type "${action.type}" di luar ruang aksi dikenali klien.`);
  }

  if (violations.length === 0) {
    return { allowed: true, violations: [], replacement: null };
  }

  return {
    allowed: false,
    violations,
    replacement: {
      type: "log_ledger",
      target: "veto-konstitusi",
      payload: `KEPUTUSAN DITOLAK VETO (type "${action.type}"): ${violations.join(" ")}`.slice(0, 500),
      reason: "Veto konstitusional hukum 7 — aksi aman pengganti: hanya dicatat, tidak dieksekusi.",
    },
  };
}

/** Ringkas laporan veto untuk jejak (dipakai klien saat menulis ledger). */
export function vetoNote(verdict: VetoVerdict): string | null {
  if (verdict.allowed) return null;
  return verdict.violations.join(" | ");
}
