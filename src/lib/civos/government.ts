// CIVITAS OS — government.ts
// PEMERINTAH = ORGANISASI INSTITUSIONAL (PRD §21–22), BUKAN satu super-LLM.
// Separation of duties: REGULATORY (registrasi) ≠ TREASURY (uang) ≠ EXECUTIVE (pengadaan) ≠ TAX.
// Pipeline: Proposal → Institusi → Analisis → Policy → Budget → Authority → Risk → Keputusan → Event.

import { db } from "@/lib/db";
import { emit } from "./events";
import { getAccount } from "./accounts";
import { accountBalance, allocateCapital, tradeInternal, postTx } from "./ledger";
import { assertCapability, getPolicy } from "./policy";
import { writeMemory } from "./memory";
import { transitionState, scoreProposal } from "./company";
import { EVENT_TYPES, KV_LAST_TICK } from "./types";
import { safeParse } from "./events";
import { fmt } from "./money";

type Step = "REGULATORY" | "TREASURY" | "EXECUTIVE" | "TAX";

/** Satu denyut pemerintah: satu institusi bekerja per denyut (rotasi deterministik). */
export async function governmentCycle(): Promise<{ step: Step; detail: string; eventSeq?: number }> {
  const gov = await db.civOrg.findUnique({ where: { code: "GOV" } });
  if (!gov) throw new Error("GOV tidak ditemukan");

  // Rotasi institusi via KV (kurang bergantung pada waktu)
  const kv = await db.civKV.findUnique({ where: { key: "gov.rotator" } });
  const steps: Step[] = ["REGULATORY", "TREASURY", "EXECUTIVE", "TAX"];
  const idx = kv ? (Number(safeParse(kv.value).idx ?? 0) % steps.length) : 0;
  const step = steps[idx];
  await db.civKV.upsert({
    where: { key: "gov.rotator" },
    create: { key: "gov.rotator", value: JSON.stringify({ idx: (idx + 1) % steps.length }) },
    update: { value: JSON.stringify({ idx: (idx + 1) % steps.length }) },
  });

  switch (step) {
    case "REGULATORY":
      return regulatoryStep(gov.id);
    case "TREASURY":
      return treasuryStep(gov.id);
    case "EXECUTIVE":
      return executiveStep(gov.id);
    case "TAX":
      return taxStep(gov.id);
  }
}

// ---------- REGULATORY: registrasi perusahaan (company.register) ----------

async function regulatoryStep(govId: string): Promise<{ step: Step; detail: string; eventSeq?: number }> {
  const agent = await db.civAgent.findFirst({ where: { orgId: govId, code: { startsWith: "GOV-REG" } } });
  if (!agent) return { step: "REGULATORY", detail: "agen REGULATORY tidak ada" };
  const pending = await db.civOrg.findFirst({ where: { kind: "COMPANY", lifecycle: "PROPOSED" }, orderBy: { createdAt: "asc" } });
  if (!pending) return { step: "REGULATORY", detail: "tidak ada pengajuan registrasi baru" };

  await assertCapability(agent.id, "company.register");
  // Analisis: kelengkapan profil (nama + spesialisasi) — kriteria objektif
  const complete = Boolean(pending.name && pending.specialization);
  if (!complete) {
    await emit({ type: EVENT_TYPES.PROPOSAL_REJECTED, subjectType: "COMPANY", subjectId: pending.id, payload: { oleh: agent.code, alasan: "profil tidak lengkap" } });
    return { step: "REGULATORY", detail: `${pending.code} DITOLAK: profil tidak lengkap` };
  }
  await transitionState(pending.id, "REGISTERED", `Diregistrasi ${agent.code} (REGULATORY)`);
  await emit({ type: EVENT_TYPES.GOVERNMENT_DECISION, subjectType: "COMPANY", subjectId: pending.id, payload: { institusi: "REGULATORY", oleh: agent.code, keputusan: "REGISTERED" } });
  await writeMemory({ ownerId: govId, ownerType: "ORG", scope: "INSTITUTIONAL", content: `REGULATORY meregistrasi ${pending.code} (${pending.name}).`, provenance: { oleh: agent.code } });
  const seq = await emit({ type: EVENT_TYPES.COMPANY_REGISTERED, subjectType: "COMPANY", subjectId: pending.id, payload: { kode: pending.code, oleh: agent.code } });
  return { step: "REGULATORY", detail: `${pending.code} terdaftar`, eventSeq: seq };
}

// ---------- TREASURY: analisis + keputusan alokasi modal (treasury.allocate) ----------

async function treasuryStep(govId: string): Promise<{ step: Step; detail: string; eventSeq?: number }> {
  const agent = await db.civAgent.findFirst({ where: { orgId: govId, code: { startsWith: "GOV-TRE" } } });
  if (!agent) return { step: "TREASURY", detail: "agen TREASURY tidak ada" };

  // --- Pencairan anggaran pemerintah (budget disbursement) bila kas di bawah lantai ---
  const govOps = await getAccount(govId, "OPERATING");
  const govCash = govOps ? await accountBalance(govOps.id) : 0;
  const floor = (await getPolicy<number>("GOV_BUDGET_FLOOR")) ?? 100_000;
  if (govOps && govCash < floor) {
    const grantAmt = (await getPolicy<number>("GOV_BUDGET_GRANT")) ?? 500_000;
    const nation = await db.civOrg.findUnique({ where: { code: "NUSANTARA" } });
    const treasuryAcc = nation ? await getAccount(nation.id, "TREASURY") : null;
    if (treasuryAcc) {
      const r = await postTx({
        idempotencyKey: `govbudget-${Date.now()}`,
        txType: "TRANSFER",
        purpose: `Pencairan anggaran pemerintah oleh ${agent.code} (kas ${govCash} < lantai ${floor})`,
        actorAgentId: agent.id,
        eventType: EVENT_TYPES.GOVERNMENT_DECISION,
        subjectType: "GOVERNMENT",
        subjectId: govId,
        meta: { institusi: "TREASURY", aksi: "ANGGARAN", jumlah: grantAmt },
        legs: [
          { accountId: govOps.id, side: "DEBIT", amount: grantAmt },
          { accountId: treasuryAcc.id, side: "CREDIT", amount: grantAmt },
        ],
      });
      if (r.ok) {
        const seq = await emit({ type: EVENT_TYPES.PROPOSAL_EXECUTED, subjectType: "GOVERNMENT", subjectId: govId, payload: { aksi: "PENCAIRAN_ANGGARAN", jumlah: grantAmt, oleh: agent.code } });
        return { step: "TREASURY", detail: `anggaran pemerintah dicairkan ${fmt(grantAmt)}`, eventSeq: seq };
      }
    }
  }

  const proposal = await db.civProposal.findFirst({ where: { kind: "CAPITAL_ALLOCATION", status: "SUBMITTED" }, orderBy: { createdAt: "asc" } });
  if (!proposal) return { step: "TREASURY", detail: "tidak ada proposal alokasi menunggu" };

  const nation = await db.civOrg.findUnique({ where: { code: "NUSANTARA" } });
  const treasuryAcc = nation ? await getAccount(nation.id, "TREASURY") : null;
  const treasuryBal = treasuryAcc ? await accountBalance(treasuryAcc.id) : 0;
  const reserveMin = (await getPolicy<number>("RESERVE_MIN")) ?? 50_000;

  const payload = safeParse(proposal.payload);
  const ask = Number(payload.capitalAsk ?? 0) || 0;
  const orgCode = String(payload.orgCode ?? "?");
  const company = await db.civOrg.findUnique({ where: { code: orgCode } });

  await db.civProposal.update({ where: { id: proposal.id }, data: { status: "ANALYZED" } });

  if (!company) {
    await db.civProposal.update({ where: { id: proposal.id }, data: { status: "REJECTED", decidedBy: agent.code, reason: "orgCode tak dikenal" } });
    return { step: "TREASURY", detail: "proposal ditolak: org tak dikenal" };
  }

  // Anti dobel-alokasi: bila kas perusahaan kini sudah cukup, proposal dianggap usang.
  const opAcc = await getAccount(company.id, "OPERATING");
  const opBal = opAcc ? await accountBalance(opAcc.id) : 0;
  if (opBal >= ask * 0.5 && ask > 0) {
    await db.civProposal.update({ where: { id: proposal.id }, data: { status: "REJECTED", decidedBy: agent.code, reason: `proposal usang — kas ${opBal} sudah ≥ 50% ask` } });
    await emit({ type: EVENT_TYPES.PROPOSAL_REJECTED, subjectType: "PROPOSAL", subjectId: proposal.id, payload: { oleh: agent.code, alasan: "usang: kas tercukupi", kas: opBal } });
    return { step: "TREASURY", detail: `${orgCode} proposal usang (kas ${opBal}) — ditolak` };
  }

  // Skor transparan (bukan optimism AI)
  const { score, notes } = scoreProposal({ reputation: 50, capitalAsk: ask, treasury: treasuryBal, reserveMin, lifecycle: company.lifecycle });
  const headroom = treasuryBal - reserveMin;
  const budgetOk = ask <= headroom && ask > 0;
  const policyCheck = { skor: score, catatan: notes, headroom, budgetOk, reserveMin };
  await db.civProposal.update({ where: { id: proposal.id }, data: { policyCheck: JSON.stringify(policyCheck) } });

  await emit({ type: EVENT_TYPES.PROPOSAL_ANALYZED, subjectType: "PROPOSAL", subjectId: proposal.id, payload: policyCheck });

  if (!budgetOk) {
    await db.civProposal.update({ where: { id: proposal.id }, data: { status: "REJECTED", decidedBy: agent.code, reason: `headroom kas tidak cukup (${fmt(headroom)} < ask ${fmt(ask)})` } });
    await emit({ type: EVENT_TYPES.PROPOSAL_REJECTED, subjectType: "PROPOSAL", subjectId: proposal.id, payload: { oleh: agent.code, alasan: "budget check gagal" } });
    return { step: "TREASURY", detail: `${orgCode} ditolak: headroom ${fmt(headroom)} < ask ${fmt(ask)}` };
  }

  await assertCapability(agent.id, "treasury.allocate");
  const operating = await getAccount(company.id, "OPERATING");
  if (!treasuryAcc || !operating) return { step: "TREASURY", detail: "akun treasury/operating tidak ada" };

  const r = await allocateCapital(treasuryAcc.id, operating.id, ask, agent.id, `Alokasi modal ${orgCode} (skor ${score})`, `alloc-${orgCode}-${proposal.id}`);
  if (!r.ok) {
    await db.civProposal.update({ where: { id: proposal.id }, data: { status: "REJECTED", decidedBy: agent.code, reason: r.reason } });
    return { step: "TREASURY", detail: `alokasi gagal: ${r.reason}` };
  }
  await transitionState(company.id, "CAPITALIZED", `Diberi modal oleh ${agent.code} (TREASURY)`);
  await db.civProposal.update({ where: { id: proposal.id }, data: { status: "APPROVED", decidedBy: agent.code, reason: `skor ${score}; ${notes.join("; ")}` } });
  const seq = await emit({ type: EVENT_TYPES.PROPOSAL_APPROVED, subjectType: "PROPOSAL", subjectId: proposal.id, payload: { oleh: agent.code, ask, skor: score, txId: r.txId } });
  return { step: "TREASURY", detail: `${orgCode} diberi modal ${fmt(ask)} (skor ${score})`, eventSeq: seq };
}

// ---------- EXECUTIVE: pengadaan internal (permintaan dari perusahaan) ----------

async function executiveStep(govId: string): Promise<{ step: Step; detail: string; eventSeq?: number }> {
  const agent = await db.civAgent.findFirst({ where: { orgId: govId, code: { startsWith: "GOV-GUB" } } });
  if (!agent) return { step: "EXECUTIVE", detail: "agen EXECUTIVE tidak ada" };

  const govAcc = await getAccount(govId, "OPERATING");
  const govCash = govAcc ? await accountBalance(govAcc.id) : 0;
  if (govCash < 2000) return { step: "EXECUTIVE", detail: `kas pemerintah tipis (${fmt(govCash)}) — pengadaan ditahan` };

  // Pilih perusahaan ACTIVE/GROWING dengan kas paling tipis (menjaga keselarasan, anti-konsentrasi)
  const candidates = await db.civOrg.findMany({ where: { kind: "COMPANY", lifecycle: { in: ["ACTIVE", "GROWING", "CAPITALIZED"] } }, orderBy: { createdAt: "asc" } });
  if (candidates.length === 0) return { step: "EXECUTIVE", detail: "belum ada perusahaan bermodal untuk pengadaan" };
  let picked: { org: typeof candidates[number]; opBal: number } | null = null;
  for (const c of candidates) {
    const op = await getAccount(c.id, "OPERATING");
    const bal = op ? await accountBalance(op.id) : 0;
    if (!picked || bal < picked.opBal) picked = { org: c, opBal: bal };
  }
  if (!picked) return { step: "EXECUTIVE", detail: "tidak ada kandidat" };

  const amount = 10000; // 100,00 FLR pengadaan jasa internal
  const r = await tradeInternal(govId, picked.org.id, amount, `Pengadaan jasa internal oleh EXECUTIVE dari ${picked.org.code}`, `proc-${picked.org.code}-${Date.now()}`, agent.id);
  if (!r.ok) return { step: "EXECUTIVE", detail: `pengadaan gagal: ${r.reason}` };

  const seq = await emit({ type: EVENT_TYPES.GOVERNMENT_DECISION, subjectType: "COMPANY", subjectId: picked.org.id, payload: { institusi: "EXECUTIVE", oleh: agent.code, aksi: "PENGADAAN_INTERNAL", jumlah: amount, klasifikasi: "INTERNAL — bukan revenue eksternal" } });
  return { step: "EXECUTIVE", detail: `pengadaan dari ${picked.org.code} ${fmt(amount)} (internal)`, eventSeq: seq };
}

// ---------- TAX: pajak HANYA atas revenue eksternal ----------

async function taxStep(govId: string): Promise<{ step: Step; detail: string; eventSeq?: number }> {
  const agent = await db.civAgent.findFirst({ where: { orgId: govId, code: { startsWith: "GOV-TAX" } } });
  if (!agent) return { step: "TAX", detail: "agen TAX tidak ada" };

  // Pajak OTOMATIS atas revenue eksternal yang belum dipajaki (meta.taxed != true).
  const pending = await db.civTxn.findMany({
    where: { isExternal: true, txType: "REVENUE_EXTERNAL", meta: { contains: '"taxed":false' } },
    include: { entries: { where: { side: "DEBIT" }, select: { amount: true, accountId: true } } },
  });
  if (pending.length === 0) {
    return { step: "TAX", detail: "belum ada revenue eksternal baru — pajak nol (jujur; internal tidak kena)" };
  }

  const rate = (await getPolicy<number>("TAX_RATE_EXTERNAL")) ?? 0.10;
  const govTaxAcc = await getAccount(govId, "TAX");
  if (!govTaxAcc) return { step: "TAX", detail: "akun pajak tidak ada" };

  let totalTax = 0;
  let sources = 0;
  for (const t of pending) {
    const amount = t.entries.reduce((s, e) => s + e.amount, 0);
    const tax = Math.floor(amount * rate);
    if (tax <= 0) { await db.civTxn.update({ where: { id: t.id }, data: { meta: (t.meta || "{}").replace('"taxed":false', '"taxed":true') } }); continue; }
    const debitAcc = t.entries[0]?.accountId;
    if (!debitAcc) continue;
    const r = await postTx({
      idempotencyKey: `tax-${t.id}`,
      txType: "TAX",
      purpose: `Pajak eksternal ${(rate * 100).toFixed(0)}% atas ${t.purpose.slice(0, 60)}`,
      actorAgentId: agent.id,
      eventType: EVENT_TYPES.TAX_PAID,
      subjectType: "TX",
      subjectId: t.id,
      meta: { sourceTx: t.id, rate },
      legs: [
        { accountId: govTaxAcc.id, side: "DEBIT", amount: tax },
        { accountId: debitAcc, side: "CREDIT", amount: tax },
      ],
    });
    if (r.ok) {
      totalTax += tax;
      sources += 1;
      await db.civTxn.update({ where: { id: t.id }, data: { meta: (t.meta || "{}").replace('"taxed":false', '"taxed":true') } });
      await emit({ type: EVENT_TYPES.TAX_ASSESSED, subjectType: "TX", subjectId: t.id, payload: { pajak: tax, tarif: rate, oleh: agent.code } });
    }
  }
  const seq = sources > 0 ? await emit({ type: EVENT_TYPES.GOVERNMENT_DECISION, subjectType: "GOVERNMENT", subjectId: govId, payload: { institusi: "TAX", sumber: sources, totalPajak: totalTax } }) : undefined;
  return { step: "TAX", detail: `pajak otomatis: ${sources} settlement → ${fmt(totalTax)} masuk kas pajak`, eventSeq: seq };
}
