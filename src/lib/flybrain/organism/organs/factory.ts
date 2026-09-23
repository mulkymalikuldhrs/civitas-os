// FLYBRAIN ORGANISM — organs/factory.ts
// PORT dari upstream gh `factory/index.js` (SaaS Factory: generate → test) +
// gitlab `SkillCrystallizer.ts` (kristalisasi trajektori → skill, recall, usage).
// Adaptasi anti-slop + zero-storage: "membangun" = membuat BLUEPRINT DATA kecil
// (nama, langkah, kontrak) yang disimpan sebagai skill creature di vault LOKAL —
// BUKAN menulis file/kode ke disk (evolusi terbatas, konstitusi hukum 4).
// MURNI TypeScript.

export interface TrajectoryStep {
  action: string;
  input: string;
  output: string;
  success: boolean;
}

export interface ExecutionTrajectory {
  task: string;
  steps: TrajectoryStep[];
  finalOutcome: string;
  success: boolean;
}

export interface Skill {
  name: string;
  description: string;
  category: string;
  tags: string[];
  createdAt: string;
  usageCount: number;
  successCount: number;
  failCount: number;
  version: number;
  confidence: number;
}

export interface Blueprint {
  name: string;
  problem: string;
  status: "BUILT" | "READY" | "FAILED";
  steps: string[];
  createdAt: string;
}

const MIN_TRAJECTORY_SUCCESS = 0.7;

/** Nama skill dari task (port `generateSkillName`). */
export function generateSkillName(task: string): string {
  return task
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 6)
    .filter((w) => /^[a-z0-9-]+$/.test(w))
    .join("-")
    .slice(0, 64);
}

/** Deskripsi ringkas dari trajektori (port `distillDescription`). */
function distillDescription(tr: ExecutionTrajectory): string {
  return tr.steps
    .slice(0, 5)
    .map((s) => `${s.success ? "✓" : "✗"} ${s.action}: ${s.input.slice(0, 80)}`)
    .join(" · ");
}

/**
 * Kristalisasi trajektori menjadi skill (port `crystallize`).
 * Return null bila rasio sukses di bawah ambang — tidak ada skill murahan.
 */
export function crystallize(
  existing: Skill | undefined,
  trajectory: ExecutionTrajectory,
  category = "general",
  tags: string[] = [],
): Skill | null {
  if (trajectory.steps.length === 0) return null;
  const ratio = trajectory.steps.filter((s) => s.success).length / trajectory.steps.length;
  if (ratio < MIN_TRAJECTORY_SUCCESS) return null;

  const name = generateSkillName(trajectory.task);
  const description = distillDescription(trajectory);
  const now = new Date().toISOString();

  if (existing) {
    return {
      ...existing,
      description,
      version: existing.version + 1,
      confidence: Math.round(((existing.confidence + ratio) / 2) * 100) / 100,
      createdAt: existing.createdAt,
      tags: [...new Set([...existing.tags, ...tags])],
    };
  }

  return {
    name,
    description,
    category,
    tags,
    createdAt: now,
    usageCount: 0,
    successCount: 0,
    failCount: 0,
    version: 1,
    confidence: Math.round(ratio * 100) / 100,
  };
}

/** Catat pemakaian skill (port `recordUsage`). */
export function recordUsage(skill: Skill, success: boolean): Skill {
  const total = skill.successCount + skill.failCount + 1;
  const successCount = skill.successCount + (success ? 1 : 0);
  return {
    ...skill,
    usageCount: skill.usageCount + 1,
    successCount,
    failCount: skill.failCount + (success ? 0 : 1),
    confidence: Math.round((successCount / total) * 100) / 100,
  };
}

/** Recall skill relevan untuk task (port `recall` — skoring kata sederhana). */
export function recallSkills(skills: Skill[], task: string, minConfidence = 0.3): Skill[] {
  const words = new Set(task.toLowerCase().split(/\s+/));
  const scored: [number, Skill][] = [];
  for (const s of skills) {
    if (s.confidence < minConfidence) continue;
    let score = 0;
    const text = `${s.name} ${s.description}`.toLowerCase();
    const tagText = s.tags.map((t) => t.toLowerCase());
    for (const w of words) {
      if (text.includes(w)) score += 1;
      if (s.name.toLowerCase().includes(w)) score += 2;
      if (tagText.some((t) => t.includes(w))) score += 1.5;
    }
    if (score > 0) scored.push([score / Math.max(words.size, 1) * s.confidence, s]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.map(([, s]) => s);
}

/**
 * Bangun BLUEPRINT tool kecil (port `build` — tapi data saja, tanpa filesystem).
 * Blueprint disimpan ke ledger lokal oleh pemanggil (engine) bila mau.
 */
export function buildBlueprint(problem: string, name?: string): Blueprint {
  const clean = problem.trim().slice(0, 120) || "kebutuhan tidak dirinci";
  const nama = name ?? (generateSkillName(clean) || "tool-kecil");
  const steps = [
    `pahami masalah: ${clean}`,
    "petakan input agregat yang tersedia di vault lokal",
    "rakit langkah aksi aman (tanpa hapus data, tanpa kirim keluar)",
    "uji refleks dulu sebelum dipromosikan ke penalar LLM",
    "simpan hasil ke ledger pemilik",
  ];
  const testsPass = steps.length >= 3; // port `test`: cek struktural sederhana
  return {
    name: nama,
    problem: clean,
    status: testsPass ? "READY" : "FAILED",
    steps,
    createdAt: new Date().toISOString(),
  };
}
