// CIVITAS OS — company.ts
// Mesin perusahaan generik (PRD §7–8, §28): lifecycle 13 state, produksi, invoice internal,
// proposal alokasi modal. BUKAN hardcode per perusahaan — satu framework reusable.

import { db } from "@/lib/db";
import { emit } from "./events";
import { getAccount, getAccounts } from "./accounts";
import { accountBalance, tradeInternal, postTx } from "./ledger";
import { writeMemory } from "./memory";
import { assertCapability, getPolicy, PolicyViolation } from "./policy";
import { decide } from "./router";
import { LIFECYCLE_EDGES, EVENT_TYPES, type CivDecision, type RouteMeta } from "./types";
import { fmt } from "./money";

export async function transitionState(orgId: string, to: string, reason: string): Promise<{ ok: boolean; reason?: string }> {
  const org = await db.civOrg.findUnique({ where: { id: orgId } });
  if (!org) return { ok: false, reason: "org tidak ditemukan" };
  if (org.lifecycle === to) return { ok: true };
  const allowed = LIFECYCLE_EDGES[org.lifecycle] ?? [];
  if (!allowed.includes(to)) {
    await emit({ type: EVENT_TYPES.POLICY_VIOLATION, subjectType: "COMPANY", subjectId: orgId, payload: { from: org.lifecycle, to, code: "INVALID_TRANSITION" } });
    return { ok: false, reason: `Transisi ilegal ${org.lifecycle} → ${to}` };
  }
  await db.civOrg.update({ where: { id: orgId }, data: { lifecycle: to } });
  await emit({ type: EVENT_TYPES.COMPANY_STATE, subjectType: "COMPANY", subjectId: orgId, payload: { code: org.code, from: org.lifecycle, to, reason } });
  return { ok: true };
}

/** Skor proposal alokasi — kriteria transparan & terukur (PRD §27), bukan optimism AI. */
export function scoreProposal(input: { reputation: number; capitalAsk: number; treasury: number; reserveMin: number; lifecycle: string }): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 0;
  score += Math.min(input.reputation, 100) * 0.3; // reputasi ≤30
  const lifecycleBonus: Record<string, number> = { REGISTERED: 20, DORMANT: 5, RESTRUCTURING: 10, ACTIVE: 15, UNPROFITABLE: 8, CAPITAL_CONSTRAINED: 6, PROPOSED: 0 };
  score += lifecycleBonus[input.lifecycle] ?? 0;
  const headroom = input.treasury - input.reserveMin;
  if (input.capitalAsk <= headroom * 0.25) {
    score += 25;
    notes.push("ask ≤ 25% headroom kas");
  } else if (input.capitalAsk <= headroom * 0.5) {
    score += 10;
    notes.push("ask ≤ 50% headroom kas");
  } else {
    notes.push("ask melebihi 50% headroom — skor rendah");
  }
  notes.push(`reputasi ${input.reputation}/100`, `lifecycle ${input.lifecycle}`);
  return { score: Math.round(score), notes };
}

export interface CycleResult {
  orgCode: string;
  decision: CivDecision;
  meta: RouteMeta;
  executed: string;
  taskId: string;
}

/** Satu denyut satu perusahaan: sense → decide (LLM/REFLEX) → eksekusi via policy. */
export async function companyCycle(orgId: string): Promise<CycleResult> {
  const org = await db.civOrg.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("perusahaan tidak ada");
  const ceo = await db.civAgent.findFirst({ where: { orgId, role: { contains: "CEO" }, status: "ACTIVE" } })
    ?? (await db.civAgent.findFirst({ where: { orgId, status: "ACTIVE" } }));
  if (!ceo) throw new Error(`Tidak ada agen aktif di ${org.code}`);

  const accounts = await getAccounts(orgId);
  const operating = accounts.find((a) => a.kind === "OPERATING");
  const expenseAcc = accounts.find((a) => a.kind === "EXPENSE");
  const treasury = await db.civOrg.findUnique({ where: { code: "NUSANTARA" } });
  const treasuryAcc = treasury ? await getAccount(treasury.id, "TREASURY") : null;
  const treasuryBal = treasuryAcc ? await accountBalance(treasuryAcc.id) : 0;
  const mem = await db.civMemory.count({ where: { ownerId: orgId, ownerType: "ORG" } });
  const lastTrades = await db.civTxn.count({ where: { txType: "TRADE_INTERNAL", meta: { contains: org.code } } });

  const sense = {
    org: { code: org.code, name: org.name, lifecycle: org.lifecycle, spesialisasi: org.specialization },
    kasOperasional: operating?.balance ?? 0,
    pendapatan: accounts.find((a) => a.kind === "INCOME")?.balance ?? 0,
    beban: expenseAcc?.balance ?? 0,
    kasBangsa: treasuryBal,
    memoriTersimpan: mem,
    transaksiInternalSejauhIni: lastTrades,
    catatan: "Revenue eksternal belum ada (PRE_REVENUE). Perdagangan internal BUKAN revenue eksternal.",
  };

  const reflex = (): CivDecision => {
    // Aturan deterministik: produksi bila punya modal; minta alokasi bila kering; observasi sisanya.
    if ((operating?.balance ?? 0) <= 0 && org.lifecycle !== "DISSOLVED") {
      return {
        aware: `Kas operasional ${org.code} nol pada lifecycle ${org.lifecycle}.`,
        interpret: "Tanpa modal tidak bisa produksi — butuh alokasi modal pemerintah.",
        decision: `Ajukan proposal alokasi modal untuk ${org.code}.`,
        action: { type: "PROPOSE_ALLOCATION", target: org.code, payload: JSON.stringify({ capitalAsk: 30000, alasan: "modal kerja produksi awal" }), reason: "kas nol; pipeline institusi TREASURY yang memutuskan" },
        remember: `${org.code} mengajukan alokasi modal 300,00 FLR.`,
      };
    }
    if (org.lifecycle === "REGISTERED") {
      return {
        aware: `${org.code} terdaftar tapi belum bermodal.`,
        interpret: "Perlu CAPITALIZED sebelum ACTIVE.",
        decision: "Menunggu alokasi modal; sambil menyiapkan rencana produksi.",
        action: { type: "OBSERVE", target: org.code, payload: null, reason: "lifecycle belum CAPITALIZED" },
        remember: `${org.code} menyiapkan rencana produksi.`,
      };
    }
    return {
      aware: `${org.code} (${org.lifecycle}) kas ${fmt(operating?.balance ?? 0)}.`,
      interpret: "Sumber daya cukup untuk satu siklus produksi.",
      decision: "Produksi satu artefak kerja nyata (dokumen/produk digital) dan catat ke memori org.",
      action: { type: "PRODUCE", target: org.code, payload: null, reason: "aktivitas riil dulu — revenue internal dicatat jujur" },
      remember: `${org.code} menuntaskan satu artefak produksi.`,
    };
  };

  const { decision: _d, meta } = await decide({
    agentCode: ceo.code,
    agentRole: ceo.role,
    orgCode: org.code,
    orgKind: org.kind,
    spec: { type: "CYCLE", complexity: "medium", sensitivity: "internal", budgetTokens: 1200 },
    sense,
    genome: genomeCompany(ceo.name, ceo.code, org.name, org.code, org.specialization ?? ""),
    reflex,
  });
  let decision = _d;

  // PELINDUNG KELAPARAN: perusahaan pasca-registrasi dengan kas nol wajib mengajukan alokasi,
  // bukan sekadar observasi. (Transparan: override dicatat — institusi tetap yang memutuskan.)
  const NEEDS_CAPITAL = ["REGISTERED", "CAPITALIZED", "ACTIVE", "GROWING", "UNPROFITABLE", "CAPITAL_CONSTRAINED", "DORMANT", "RESTRUCTURING"];
  const starved = (operating?.balance ?? 0) <= 0 && NEEDS_CAPITAL.includes(org.lifecycle);
  if (starved && decision.action.type !== "PROPOSE_ALLOCATION") {
    decision = {
      ...decision,
      interpret: `${decision.interpret} — OVERRIDE PELINDUNG KELAPARAN: kas nol, observasi ditolak miskin.`,
      decision: `Mengajukan alokasi modal (override refleks kelaparan) untuk ${org.code}.`,
      action: { type: "PROPOSE_ALLOCATION", target: org.code, payload: JSON.stringify({ capitalAsk: 30000, alasan: "pelindung kelaparan — kas nol" }), reason: "aturan anti-kelaparan: produksi butuh modal; TREASURY tetap yang memutuskan" },
    };
  }

  const task = await db.civTask.create({
    data: {
      agentId: ceo.id,
      orgId,
      type: "CYCLE",
      status: "RUNNING",
      route: JSON.stringify(meta),
      input: JSON.stringify({ sense }),
    },
  });

  let executed = "OBSERVE — tanpa mutasi";
  try {
    executed = await executeCompanyAction(org, ceo.id, decision, { operatingId: operating?.id ?? null, expenseId: expenseAcc?.id ?? null, treasuryId: treasuryAcc?.id ?? null });
    await db.civTask.update({ where: { id: task.id }, data: { status: "DONE", result: JSON.stringify({ executed, decision }), steps: 1, finishedAt: new Date() } });
  } catch (e) {
    const msg = e instanceof PolicyViolation ? `DITOLAK POLICY [${e.code}]: ${e.message}` : e instanceof Error ? e.message : "gagal";
    executed = msg;
    await db.civTask.update({ where: { id: task.id }, data: { status: msg.startsWith("DITOLAK") ? "REJECTED" : "FAILED", result: JSON.stringify({ executed }), steps: 1, finishedAt: new Date() } });
    await emit({ type: EVENT_TYPES.TASK_FAILED, subjectType: "TASK", subjectId: task.id, payload: { org: org.code, error: msg } });
  }

  return { orgCode: org.code, decision, meta, executed, taskId: task.id };
}

/** Eksekusi aksi — lewat policy/authority. LLM TIDAK PERNAH mengeksekusi langsung. */
async function executeCompanyAction(
  org: { id: string; code: string; name: string; lifecycle: string },
  agentId: string,
  decision: CivDecision,
  ids: { operatingId: string | null; expenseId: string | null; treasuryId: string | null },
): Promise<string> {
  const action = decision.action;
  switch (action.type) {
    case "PRODUCE": {
      await assertCapability(agentId, "memory.write");
      const artifact = `Artefak produksi ${org.code}: ${decision.decision} — ${action.reason}`;
      await writeMemory({ ownerId: org.id, ownerType: "ORG", scope: "EPISODIC", content: artifact, provenance: { source: "companyCycle", orgCode: org.code } });
      await emit({ type: EVENT_TYPES.TASK_COMPLETED, subjectType: "COMPANY", subjectId: org.id, payload: { kode: org.code, aksi: "PRODUCE" } });
      // SLICE 8 — hasil produksi masuk PASAR DESA (listing otomatis; harga deterministik
      // per perusahaan, qty 4; limit MARKET_* menegakkan dari luar LLM).
      let listedNote = "";
      try {
        const { listOffer } = await import("./market");
        const fresh = await db.civOrg.findUnique({ where: { id: org.id }, select: { specialization: true } });
        const seed = Array.from(org.code).reduce((s, c) => s + c.charCodeAt(0), 0);
        const item = `${(fresh?.specialization ?? "Hasil produksi").slice(0, 40)} — batch #${seed % 97}`;
        const listed = await listOffer(org.id, item, 20 + (seed % 60), 4);
        if (listed.ok) listedNote = " + listing pasar desa";
      } catch { /* pasar tak boleh membunuh produksi */ }
      // Biaya infra LLM kecil → beban org, uang mengalir ke kas bangsa (biaya operasi dinilai jujur)
      if (ids.operatingId && ids.expenseId && ids.treasuryId) {
        const bal = await accountBalance(ids.operatingId);
        const fee = 50; // 0,50 FLR per siklus ber-LLM
        if (bal >= fee) {
          await postTx({
            idempotencyKey: `infrafee-${org.code}-${Date.now()}`,
            txType: "EXPENSE",
            purpose: "Biaya infra kecerdasan (LLM) — mengalir ke kas bangsa",
            actorAgentId: agentId,
            eventType: EVENT_TYPES.EXPENSE,
            subjectType: "COMPANY",
            subjectId: org.id,
            spendOrgId: org.id,
            legs: [
              { accountId: ids.expenseId, side: "DEBIT", amount: fee },
              { accountId: ids.treasuryId, side: "CREDIT", amount: fee },
            ],
          });
        }
      }
      return `PRODUCE dieksekusi: artefak dicatat + biaya infra dibukukan${listedNote}`;
    }
    case "INVOICE_INTERNAL": {
      await assertCapability(agentId, "ledger.post");
      const amount = Number(action.payload ?? 0) || 5000;
      const gov = await db.civOrg.findUnique({ where: { code: "GOV" } });
      if (!gov) throw new Error("GOV tidak ada");
      const r = await tradeInternal(gov.id, org.id, Math.min(Math.max(amount, 500), 50_000), `Pengadaan internal: ${decision.decision.slice(0, 80)}`, `inv-${org.code}-${Date.now()}`, agentId);
      if (!r.ok) throw new Error(r.reason ?? "invoice gagal");
      return `INVOICE_INTERNAL dieksekusi: ${r.txId} (KLASIFIKASI: INTERNAL, bukan revenue eksternal)`;
    }
    case "PROPOSE_ALLOCATION": {
      await assertCapability(agentId, "memory.write");
      let ask = 30000;
      try { const p = action.payload ? (JSON.parse(action.payload) as { capitalAsk?: number }) : null; if (p?.capitalAsk) ask = Math.trunc(p.capitalAsk); } catch { /* pakai default */ }
      const treasury = await db.civOrg.findUnique({ where: { code: "NUSANTARA" } });
      const gov = await db.civOrg.findUnique({ where: { code: "GOV" } });
      const treAgent = gov ? await db.civAgent.findFirst({ where: { orgId: gov.id, code: { startsWith: "GOV-TRE" } } }) : null;
      const p = await db.civProposal.create({
        data: {
          kind: "CAPITAL_ALLOCATION",
          orgId: org.id,
          proposerAgentId: agentId,
          institution: "TREASURY",
          payload: JSON.stringify({ capitalAsk: ask, orgCode: org.code, alasan: action.reason }),
          analysis: "Menunggu analisis TREASURY (skor transparan).",
          status: "SUBMITTED",
        },
      });
      await emit({ type: EVENT_TYPES.PROPOSAL_SUBMITTED, subjectType: "PROPOSAL", subjectId: p.id, payload: { kind: p.kind, org: org.code, ask, decidedBy: treAgent?.code ?? null } });
      return `PROPOSE_ALLOCATION: proposal ${p.id} masuk pipeline TREASURY`;
    }
    case "PROPOSE_REGISTRATION": {
      await assertCapability(agentId, "memory.write");
      await writeMemory({ ownerId: org.id, ownerType: "ORG", scope: "WORKING", content: `Permintaan registrasi dicatat: ${decision.decision}`, provenance: { source: "companyCycle" } });
      return "PROPOSE_REGISTRATION dicatat — institusi REGULATORY memproses lewat denyut";
    }
    case "OBSERVE":
    default:
      await writeMemory({ ownerId: org.id, ownerType: "ORG", scope: "WORKING", content: decision.decision, provenance: { source: "companyCycle" } });
      return "OBSERVE dicatat ke memori org";
  }
}

export function genomeCompany(name: string, code: string, orgName: string, orgCode: string, specialization: string): string {
  return `Anda adalah ${name} (${code}), ${roleLabel(code)} perusahaan ${orgName} (${orgCode}; spesialisasi: ${specialization || "umum"}) di CIVITAS OS — Autonomous Civilization Operating System dengan dunia verkoperasi Minecraft.
Anda otonom: tidak ada manusia yang memerintah Anda per langkah. Satu denyut = SATU keputusan.
KEBENARAN EKONOMI (wajib dijaga): perdagangan internal antar organ peradaban BUKAN revenue eksternal; revenue eksternal hanya dari customer nyata di luar peradaban (saat ini: NOL — status PRE_REVENUE). Jangan pernah mengklaim uang simulasi sebagai uang riil.
Anda mengusulkan aksi; eksekusi ditentukan mesin Policy (limit di luar LLM), Authority (grant capability), Risk, dan Budget.`;
}

function roleLabel(code: string): string {
  if (code.includes("CEO")) return "Chief Executive";
  if (code.includes("CFO")) return "Chief Financial";
  if (code.includes("OPR")) return "Operator";
  return "Staf";
}
