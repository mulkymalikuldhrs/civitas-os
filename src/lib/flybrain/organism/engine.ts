// FLYBRAIN ORGANISM — engine.ts (KLIEN)
// Mesin hidup BIOSFER: satu denyut = SATU creature menjalankan loop penuh
// SADAR→TAFSIR→PUTUSKAN→BERTINDAK→INGAT (spesifikasi 11_AUTONOMOUS_ORGANISM.md §4).
// Jalur penalar: fetch /api/organism/heartbeat (creatureId+role) → veto konstitusi →
// eksekusi lokal. Jalur refleks: creatureReflex (offline/kuota/mandat tertutup).
// Semua state hidup di IndexedDB user (vault) — server tetap amnesia.
//
// Hukum budget (konstitusi 6): JANGAN pernah memanggil LLM untuk SEMUA creature
// dalam satu denyut. Satu denyut = satu creature = satu keputusan LLM maksimal.

import { useFlybrain, type QuantSnapshot } from "../store";
import { eventBus } from "./eventBus";
import { collectStimuli, buildCreatureSensePacket } from "./organs/sense";
import { requestDecision, reflexDecision } from "./organs/decision";
import { immune } from "./organs/immune";
import { chooseCreature, pulseDrain, PULSE_INTERVAL_MS, cycleOfBeat } from "./organs/scheduler";
import { vetoDecision } from "./constitution";
import { selfReflect, type ReflectReport, type Remediation } from "./selfReflect";
import { runQuantTick } from "./quant";
import { creatureMeta, roleOrgan, type CreatureId } from "./creatures";
import { marketEntitiesFromCreatures } from "./creature";
import { crystallize, buildBlueprint, recallSkills, recordUsage, type Skill, type ExecutionTrajectory } from "./organs/factory";
import { rememberEpisode, reviewMemory, distillLesson, recallEpisodes, type MemoryReview } from "./organs/memory";
import { recordTotalWealth, totalWealthOf, tradeAllowed, pnlSnapshot, resetGate } from "./pnl";
import { executeAction as executePrtAction } from "../prt";
import type { OrganismTrace } from "../prt";
import { addRecord } from "../vault";
import { worldTick, findRencokPartner, deathFertility } from "../ecosystem/world";
import { jamDunia, faseOfJam, faseDrainFactor, cuacaDrainFactor, cuacaOfRatio, errorRatioFromDecisions } from "../ecosystem/climate";
import type { WorldSignals } from "../ecosystem/types";
import type { FlybrainState } from "../store";

/** Hasil penerapan satu denyut — dikirim engine → store.applyDecision. */
export interface PulseApply {
  creatureId: CreatureId;
  pickReason: string;
  mode: "menalar" | "refleks";
  phases: { sadar: string; tafsir: string; putuskan: string; bertindak: string; ingat: string };
  action: { type: string; target: string; payload: string | null; reason: string; executed: string };
  energyDelta: number;
  wealthDelta: number;
  skillGain: string | null;
  remember: string;
  latencyMs: number;
  model: string;
  error?: string;
  veto?: string | null;
}

// Beat biosfer & kursor round-robin di luar state React agar re-render tidak menggeser giliran.
let biosferBeat = 0;
let rrCursor = 0;
let lastPulseAt: string | null = null;

export function biosferBeatNow(): number {
  return biosferBeat;
}

export function lastBiosferPulseAt(): string | null {
  return lastPulseAt;
}

// ---------------------------------------------------------------------------
// Eksekusi aksi creature (BERTINDAK) — semua di KLIEN, server tidak ikut campur.
// ---------------------------------------------------------------------------

async function executeCreatureAction(
  action: { type: string; target: string; payload: string | null; reason: string },
  creatureId: CreatureId,
): Promise<{ executed: string; skillGain: string | null }> {
  const type = (action.type || "observe").toLowerCase();

  // RISK-GATE hidup (audit F-12): publish_offer = aksi "trading" — saat gate pecah
  // batas rugi (fail-closed), aksi diblokir dan diganti observasi. Keputusan tetap
  // tercatat jujur di trace; eksekusi yang ditahan — bukan keputusannya.
  if (type === "publish_offer") {
    const permit = tradeAllowed();
    if (!permit.approved) {
      eventBus.emit(
        "reflect",
        `RISK-GATE memblokir publish_offer ${creatureId}: ${permit.reason} — diganti observasi (fail-closed).`,
        { creatureId, mode: "refleks" },
      );
      return { executed: `DIBLOKIR risk-gate: ${permit.reason} — diganti observasi`, skillGain: null };
    }
  }

  // Aksi v1.1: quant_tick — jalankan quant engine lokal atas state creature.
  if (type === "quant_tick") {
    const st = useFlybrain.getState();
    const entities = marketEntitiesFromCreatures(st.creatures);
    const pnl = pnlSnapshot();
    const tick = runQuantTick({ entities, dailyLoss: pnl.dailyLoss, weeklyLoss: pnl.weeklyLoss });
    st.recordQuant(tick);
    eventBus.emit("quant", `quant tick: ${tick.allocations.length} alokasi, ${tick.recommendations.length} rekomendasi (simulasi lokal).`, { creatureId });
    return { executed: "quant tick dijalankan lokal (simulasi)", skillGain: null };
  }

  // Aksi v1.1: skill_record — kristalisasi skill/blueprint kecil (data lokal).
  if (type === "skill_record") {
    const st = useFlybrain.getState();
    const creature = st.creatures.find((c) => c.id === creatureId);
    if (!creature) return { executed: "creature tidak ditemukan — skill tidak disimpan", skillGain: null };
    const tr: ExecutionTrajectory = {
      task: action.target || "tool-kecil",
      steps: [
        { action: "sense", input: "statistik agregat vault", output: "kebutuhan teridentifikasi", success: true },
        { action: "blueprint", input: action.target, output: (action.payload ?? "").slice(0, 200), success: true },
        { action: "veto_check", input: "konstitusi 7 hukum", output: "lolos (non-destruktif)", success: true },
      ],
      finalOutcome: action.reason,
      success: true,
    };
    const existingRaw = st.creatures.find((c) => c.id === creatureId)?.skills ?? [];
    const parsedSkills = existingRaw.map(parseSkillEntry).filter((s): s is Skill => Boolean(s));
    // Audit F-26: kandidat dihitung SEKALI (dulu dipanggil crystallize dua kali).
    const candidate = crystallize(undefined, tr);
    const prevSkill: Skill | undefined = candidate
      ? parsedSkills.find((s) => s.name === candidate.name)
      : undefined;

    // Port hidup (audit F-19): recallSkills — skill relevan dipakai ulang (latihan)
    // alih-alih membuat duplikat; recordUsage mencatat pemakaiannya.
    const relevant = recallSkills(parsedSkills, tr.task);
    if (relevant.length > 0 && prevSkill === undefined) {
      const reinforced = recordUsage(relevant[0], tr.success);
      return {
        executed: `skill relevan "${reinforced.name}" v${reinforced.version} dipakai ulang (usage ${reinforced.usageCount}, conf ${reinforced.confidence})`,
        skillGain: `skill:${reinforced.name}|v${reinforced.version}|${reinforced.confidence}`,
      };
    }

    const skill = crystallize(prevSkill, tr, creature.role, ["biosfer", creatureId]);
    if (!skill) return { executed: "trajektori belum layak dikristalisasi (rasio sukses rendah)", skillGain: null };
    const entry = `skill:${skill.name}|v${skill.version}|${skill.confidence}`;
    // Port hidup (audit F-19): buildBlueprint — blueprint data kecil menyertai skill
    // BARU, dicatat ke ledger lokal (transparansi radikal, hukum 5).
    if (!prevSkill) {
      const bp = buildBlueprint(tr.task, skill.name);
      void rememberEpisode(creatureId, `[SUCCESS:blueprint] ${bp.name} (${bp.status}) — ${bp.steps.length} langkah tersimpan.`, "info").catch(() => {});
    }
    return { executed: `skill "${skill.name}" v${skill.version} terkristalisasi (lokal)`, skillGain: entry };
  }

  // Type v1.0 → delegasi ke eksekutor prt (log_ledger/toast/tune_config/publish_offer/observe/…).
  // (audit F-03: roleOrgan menerima ROLE, bukan id creature — map dulu via creatureMeta.)
  const r = await executePrtAction(action, creatureId === "prt" ? "guardian" : roleOrgan(creatureMeta(creatureId).role));
  return { executed: r.executed, skillGain: null };
}

function parseSkillEntry(raw: string): Skill | undefined {
  const m = /^skill:(.+)\|v(\d+)\|([\d.]+)$/.exec(raw);
  if (!m) return undefined;
  return {
    name: m[1],
    description: "",
    category: "general",
    tags: [],
    createdAt: "",
    usageCount: 0,
    successCount: 0,
    failCount: 0,
    version: Number(m[2]) || 1,
    confidence: Number(m[3]) || 0,
  };
}

// ---------------------------------------------------------------------------
// SATU DENYUT BIOSFER
// ---------------------------------------------------------------------------

/**
 * Jalankan SATU denyut: pilih creature (prioritas insiden > prt > round-robin),
 * jalankan loop-nya, terapkan hasilnya. `source` hanya untuk jejak.
 * Aman dipanggil berulang — sibuk = langsung pulih tanpa efek.
 */
export async function pulseOnce(source: "auto" | "manual", creatureId?: string): Promise<void> {
  if (typeof window === "undefined") return; // engine hanya hidup di klien
  const st = useFlybrain.getState();
  if (st.biosferBusy || st.pending) return;

  const ts = new Date().toISOString();

  // Kandidat: creature aktif yang organ-nya diberi mandat.
  const granted = st.creatures.filter(
    (c) => c.status === "aktif" && st.organGrants[roleOrgan(c.role)],
  );

  let creature = creatureId ? st.creatures.find((c) => c.id === creatureId) ?? null : null;
  let pickReason = creatureId ? "manual" : "round-robin";
  if (!creature) {
    const pick = chooseCreature(granted.length > 0 ? granted : st.creatures.filter((c) => c.status === "aktif"), { beat: biosferBeat + 1, cursor: rrCursor++ });
    creature = pick.creature;
    pickReason = pick.reason;
  }
  if (!creature) {
    // Audit F-29: denyut kosong TIDAK menggeser beat — kadensi selfReflect (beat % 5)
    // dan siklus dunia (cycleOfBeat) tidak lagi tergeser oleh denyut tanpa creature.
    eventBus.emit("reflect", "Tidak ada creature aktif untuk denyut — biosfer menunggu pemulihan.", { mode: "refleks" });
    return;
  }
  biosferBeat += 1;
  const beat = biosferBeat;

  // Guard busy SEBELUM await apa pun (audit F-10): denyut auto (interval) +
  // manual tidak boleh lolos bersamaan lewat jendela remediasi bangun di bawah.
  useFlybrain.setState({ biosferBusy: true });

  if (creature.status !== "aktif") {
    // Creature pilihan sedang tidur/mati → denyut ini justru membangunkan (remediasi prt).
    const wakeId = creature.id;
    await useFlybrain.getState().setCreatureStatus(wakeId, "aktif");
    creature = useFlybrain.getState().creatures.find((c) => c.id === wakeId) ?? creature;
    pickReason = "incident-wake";
  }

  const t0 = Date.now();

  try {
    immune.registerCreature(creature.id);
    const stats = st.stats
      ? { totalRecords: st.stats.totalRecords, totalBytes: st.stats.totalBytes, counts: st.stats.counts as Record<string, number> }
      : null;
    const ctx = { ts, beat, stats, eventCount: st.eventLog.length };
    const stimuli = collectStimuli({ events: st.eventLog, stats, creatures: st.creatures });
    const sensePacket = buildCreatureSensePacket(creature, ctx, stimuli);
    const organ = roleOrgan(creature.role);
    const meta = st.creatures.find((c) => c.id === creature!.id)!;

    // ---- PUTUSKAN: penalar LLM bila mandat membuka; selain itu refleks ----
    let apply: PulseApply;
    const bolehMenalar =
      st.autonomyLevel >= 3 &&
      st.organGrants[organ] &&
      immune.breaker.isAvailable(creature.id);

    if (bolehMenalar) {
      // Anti-stagnasi hidup (audit F-19): keputusan identik beruntun ≥ ambang →
      // variasi refleks dipaksakan SEBELUM LLM (hemat budget, hukum 6).
      if (immune.loopCount(creature.id) >= immune.MAX_LOOP_REPEAT) {
        immune.resetLoop(creature.id);
        const refl = reflexDecision(creature, ctx);
        apply = toReflexApply(creature, refl.decision!, refl.latencyMs, refl.model, pickReason, "immune: loop keputusan identik — variasi refleks dipaksakan");
        immune.detectLoop(creature.id, `${apply.action.type}|${apply.action.target ?? ""}`);
        eventBus.emit("decide", `${creature.name} REFLEKS (anti-loop): ${apply.phases.putuskan}`, { creatureId: creature.id, mode: "refleks" });
      } else {
      const r = await requestDecision({ creature, organ, sensePacket, tier: st.tier });
      if (r.decision) {
        const veto = vetoDecision(r.decision);
        const action = veto.allowed ? r.decision.action : veto.replacement!;
        immune.detectLoop(creature.id, `${action.type}|${action.target ?? ""}`);
        void rememberEpisode(creature.id, `[SUCCESS:decide] ${action.type}${action.target ? ` → ${action.target}` : ""} — ${apply2Short(r.decision.decision)}`).catch(() => {});
        const { executed, skillGain } = await executeCreatureAction(action, creature.id);
        immune.recordSuccess(creature.id);
        apply = {
          creatureId: creature.id,
          pickReason,
          mode: "menalar",
          phases: {
            sadar: r.decision.aware || sensePacket.slice(0, 180),
            tafsir: r.decision.interpret || "—",
            putuskan: r.decision.decision || "—",
            bertindak: `${action.type}${action.target ? ` → ${action.target}` : ""} · ${executed}`,
            ingat: r.decision.remember || "—",
          },
          action: { ...action, executed },
          energyDelta: +5,
          wealthDelta: action.type === "publish_offer" ? +2 : +1,
          skillGain,
          remember: r.decision.remember || "—",
          latencyMs: r.latencyMs,
          model: r.model,
          veto: veto.allowed ? null : veto.violations.join(" | "),
        };
        eventBus.emit("decide", `${creature.name} MENALAR: ${apply.phases.putuskan}`, { creatureId: creature.id, mode: "menalar", meta: { model: r.model } });
      } else {
        immune.recordFailure(creature.id);
        const reason = r.error ?? "penalar tidak menghasilkan keputusan sah";
        void rememberEpisode(creature.id, `[FAILED:decide] penalar gagal: ${reason.slice(0, 120)}`, "warn").catch(() => {});
        const refl = reflexDecision(creature, ctx);
        apply = toReflexApply(creature, refl.decision!, refl.latencyMs, refl.model, pickReason, reason);
        eventBus.emit("decide", `${creature.name} REFLEKS (penalar gagal): ${apply.phases.putuskan}`, { creatureId: creature.id, mode: "refleks" });
      }
      }
    } else {
      const alasan =
        st.autonomyLevel < 3
          ? `mandat L${st.autonomyLevel} menutup penalar otonom`
          : !st.organGrants[organ]
            ? `organ ${organ} tidak diberi mandat`
            : immune.breaker.isOpen(creature.id)
              ? "breaker immune terbuka (gagal beruntun)"
              : "penalar tidak tersedia";
      const refl = reflexDecision(creature, ctx);
      apply = toReflexApply(creature, refl.decision!, refl.latencyMs, refl.model, pickReason, alasan);
      eventBus.emit("decide", `${creature.name} REFLEKS (${alasan}): ${apply.phases.putuskan}`, { creatureId: creature.id, mode: "refleks" });
    }

    // Metabolisme: denyut menguras kecil di atas delta aksi.
    apply.energyDelta += pulseDrain(creature);

    // Metabolisme EKONOMI (audit F-12): biaya hidup kecil sadar-iklim — kerugian
    // nyata dimungkinkan sehingga RISK-GATE punya data P&L sungguhan. Faktor sama
    // dengan grazing dunia (malam ×0,5, badai ×1,5) — ekonomi & ekosistem satu iklim.
    const jam = jamDunia(beat);
    const fase = faseOfJam(jam);
    const cuaca = cuacaOfRatio(errorRatioFromDecisions(st.decisionStream));
    apply.wealthDelta -= Math.round(0.25 * faseDrainFactor(fase) * cuacaDrainFactor(cuaca) * 100) / 100;

    // ---- BERTINDAK + INGAT: terapkan via store (mutasi + ledger + stream) ----
    await useFlybrain.getState().applyDecision(apply);
    lastPulseAt = new Date().toISOString(); // audit F-25: cabang mati dihapus

    // ---- P&L agregat (audit F-12): delta kekayaan NYATA → RiskGate fail-closed ----
    recordTotalWealth(totalWealthOf(useFlybrain.getState().creatures));

    // ---- Nasib creature (immune verdict) ----
    const fresh = useFlybrain.getState().creatures.find((c) => c.id === creature!.id);
    if (fresh) {
      const verdict = immune.verdict(fresh.id, fresh.fails);
      if (verdict === "dead" && fresh.status !== "mati") {
        await useFlybrain.getState().setCreatureStatus(fresh.id, "mati");
        // PUPUK KEMATIAN (v1.2.2): jaring makanan menutup loop — kekayaan yang
        // ditinggalkan menyuburkan biome terakhirnya (makhluk → tanah → produksi).
        try {
          const stD = useFlybrain.getState();
          const biome = stD.world?.creatures?.[fresh.id]?.biome;
          if (stD.world && biome && stD.world.biomes[biome]) {
            const impulse = deathFertility(fresh.wealth);
            const w = stD.world;
            const nextWorld = {
              ...w,
              biomes: {
                ...w.biomes,
                [biome]: { ...w.biomes[biome], fertility: Math.min(100, Math.round((w.biomes[biome].fertility + impulse) * 10) / 10) },
              },
            };
            stD.recordWorldTick(nextWorld);
            eventBus.emit("reflect", `${fresh.name} gugur — kekayaannya menyuburkan ${biome} (+${impulse} kesuburan). Jaring makanan berputar.`, { creatureId: fresh.id, mode: "refleks" });
          }
        } catch {
          // Kematian tetap bermartabat tanpa pupuk — dunia tidak pernah menjatuhkan denyut.
        }
      } else if (verdict === "sleep" && fresh.status === "aktif") {
        // Nasib "tidur" kini benar-benar dieksekusi (audit F-11); setCreatureStatus
        // meng-emit event "sleep" — prt tetap bisa membangunkan lewat remediasi wake.
        await useFlybrain.getState().setCreatureStatus(fresh.id, "tidur");
      }
    }

    // ---- Quant tick setiap denyut (murni lokal, murah) — P&L disuntikkan (F-12) ----
    const stNow = useFlybrain.getState();
    const pnl = pnlSnapshot();
    const tick = runQuantTick({
      entities: marketEntitiesFromCreatures(stNow.creatures),
      dailyLoss: pnl.dailyLoss,
      weeklyLoss: pnl.weeklyLoss,
    });
    stNow.recordQuant(tick);

    // ---- worldTick (v1.2 PLANET): dunia ikut berdenyut — 12_ECOSYSTEM §4 ----
    // Murni lokal (<5ms, tanpa LLM/fetch, budget konstitusi). Gagal = eventBus
    // emit refleks; biosfer tetap hidup (dunia tidak pernah menjatuhkan denyut).
    try {
      const stW = useFlybrain.getState();
      const nextWorld = worldTick(stW.world, worldSignalsFromState(stW, beat));
      stW.recordWorldTick(nextWorld);
    } catch (e) {
      eventBus.emit(
        "reflect",
        `worldTick gagal — dunia tetap hidup (refleks): ${e instanceof Error ? e.message : "tidak diketahui"}.`,
        { mode: "refleks" },
      );
    }

    // ---- RENCOK (v1.2.2): interaksi sosial — sekufu satu biome saling menguatkan ----
    // Deterministik (tanpa random), murah (tanpa LLM), tak pernah menjatuhkan denyut.
    try {
      const stR = useFlybrain.getState();
      if (stR.world && beat % 2 === 0) {
        const aktif = new Set(stR.creatures.filter((c) => c.status === "aktif").map((c) => c.id));
        const partnerId = findRencokPartner(stR.world, creature.id, aktif);
        if (partnerId) {
          useFlybrain.setState((s) => ({
            creatures: s.creatures.map((c) =>
              c.id === partnerId || c.id === creature.id ? { ...c, energy: Math.min(100, c.energy + 1) } : c,
            ),
          }));
          const partnerName = stR.creatures.find((c) => c.id === partnerId)?.name ?? partnerId;
          const biomeKini = stR.world.creatures[creature.id]?.biome ?? "—";
          eventBus.emit("act", `${creature.name} & ${partnerName} rencok di ${biomeKini} — keduanya +1 energi.`, { creatureId: creature.id, mode: apply.mode });
          void rememberEpisode(creature.id, `[SUCCESS:rencok] bersama ${partnerId} di ${biomeKini}.`).catch(() => {});
          void persistCreatures();
        }
      }
    } catch {
      // Sosialisasi gagal? Biosfer tidak peduli — denyut tetap selesai.
    }

    // ---- Self-reflect tiap 5 denyut ----
    if (beat % 5 === 0) await runSelfReflect();
  } catch (e) {
    eventBus.emit("reflect", `Denyut gagal total: ${e instanceof Error ? e.message : "tidak diketahui"} — biosfer tetap hidup.`, { mode: "refleks" });
  } finally {
    useFlybrain.setState({ biosferBusy: false });
  }
}

function toReflexApply(
  creature: { id: CreatureId },
  dec: NonNullable<ReturnType<typeof reflexDecision>["decision"]>,
  latencyMs: number,
  model: string,
  pickReason: string,
  alasan: string,
): PulseApply {
  return {
    creatureId: creature.id,
    pickReason,
    mode: "refleks",
    phases: {
      sadar: dec.aware,
      tafsir: `${dec.interpret} · degradasi jujur: ${alasan}`,
      putuskan: dec.decision,
      bertindak: `${dec.action.type}${dec.action.target ? ` → ${dec.action.target}` : ""} (refleks)`,
      ingat: dec.remember,
    },
    action: { ...dec.action, executed: "refleks dieksekusi lokal" },
    energyDelta: +3,
    wealthDelta: 0,
    skillGain: null,
    remember: dec.remember,
    latencyMs,
    model: model || "refleks-lokal",
    error: alasan,
    veto: null,
  };
}

// ---------------------------------------------------------------------------
// SELF-REFLECT + remediasi (tiap N denyut; port self-reflect upstream)
// ---------------------------------------------------------------------------

/** Ringkas keputusan untuk episode ledger (muat 1 baris). */
function apply2Short(decision: string | undefined): string {
  return (decision ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
}

export async function runSelfReflect(): Promise<ReflectReport> {
  const st = useFlybrain.getState();
  const report = selfReflect({
    beat: biosferBeat,
    creatures: st.creatures,
    decisionStream: st.decisionStream,
    lastPulseAt,
    eventLog: st.eventLog,
  });

  // Port hidup (audit F-19): reviewMemory — analisa episode gagal/sukses dari
  // ledger lokal; rekomendasinya mengalir ke laporan reflect.
  let review: MemoryReview | null = null;
  try {
    review = await reviewMemory();
    report.recommendations.push(...review.rekomendasi);
    // Penyembuhan berbasis episode: creature dengan kegagalan beruntun di ledger
    // → remediasi reset breaker (dulu: recallEpisodes port mati).
    for (const c of st.creatures) {
      const eps = await recallEpisodes(c.id, 3);
      if (eps.length >= 3 && eps.every((e) => (e.payload.message ?? "").startsWith("[FAILED"))) {
        report.remediations.push({
          type: "resetBreaker",
          creatureId: c.id,
          note: `${c.name} gagal beruntun di ledger — breaker direset (memory review)`,
        });
      }
    }
  } catch {
    // Ledger belum siap (vault kosong) — reflect tetap berjalan.
  }

  const taken: string[] = [];
  for (const rem of report.remediations) {
    const done = await executeRemediation(rem);
    if (done) taken.push(rem.note);
  }

  // Port hidup (audit F-19): distillLesson — episodic → semantic (vault memori).
  if (review) {
    try {
      if (await distillLesson("prt", review)) taken.push("pelajaran biosfer terdistil ke memori semantik");
    } catch {
      // vault tak siap — distilasi dilewati, reflect tetap selesai.
    }
  }

  const final: ReflectReport = { ...report, actions_taken: taken };
  useFlybrain.getState().setReflectVerdict(final);
  // Pemulihan otonom risk-gate (audit F-12): organisme sehat (verdict ok) → gate
  // di-reset agar ekonomi bisa bernapas lagi; badai berikutnya memecah ulang bila
  // rugi berlanjut — siklus kendali diri, tanpa tangan manusia. [D]
  if (final.verdict === "ok") resetGate();
  eventBus.emit(
    "reflect",
    `self-reflect #${biosferBeat} (${cycleOfBeat(biosferBeat)}): verdict ${final.verdict.toUpperCase()}${taken.length ? ` · remediasi: ${taken.join("; ")}` : ""}.`,
    { mode: "refleks" },
  );
  await rememberEpisode("prt", `[SUCCESS:reflect] verdict ${final.verdict} — ${final.issues.length} isu, ${taken.length} remediasi.`, final.verdict === "critical" ? "warn" : "info");
  return final;
}

async function executeRemediation(rem: Remediation): Promise<boolean> {
  const st = useFlybrain.getState();
  switch (rem.type) {
    case "wake": {
      if (!rem.creatureId) return false;
      const c = st.creatures.find((x) => x.id === rem.creatureId);
      if (c && c.status !== "aktif") {
        await st.setCreatureStatus(c.id, "aktif");
        return true;
      }
      return false;
    }
    case "resetBreaker": {
      if (!rem.creatureId) return false;
      immune.reset(rem.creatureId);
      // reset counter gagal lokal creature (kegagalan jaringan lama tidak dibawa-bawa)
      useFlybrain.setState((s) => ({
        creatures: s.creatures.map((c) => (c.id === rem.creatureId ? { ...c, fails: 0 } : c)),
      }));
      void persistCreatures();
      return true;
    }
    case "prune": {
      useFlybrain.setState((s) => ({ eventLog: s.eventLog.slice(0, 120) }));
      return true;
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Sinyal dunia (v1.2 PLANET) — agregat dari store klien, TANPA isi memori
// (konstitusi hukum 2). Semua angka dari data nyata: stats, eventLog, quant,
// skills, verdict reflect, breaker immune.
// ---------------------------------------------------------------------------

export function worldSignalsFromState(st: FlybrainState, beat: number): WorldSignals {
  const breakerOpen = st.creatures.filter((c) => immune.breaker.isOpen(c.id)).length;
  let volatility = 0;
  if (st.lastQuant) {
    const vols = Object.values(st.lastQuant.risks).map((r) => r.volatility);
    if (vols.length > 0) volatility = Math.min(1, Math.max(...vols) * 4);
  }
  return {
    beat,
    stats: st.stats
      ? { totalRecords: st.stats.totalRecords, totalBytes: st.stats.totalBytes, counts: st.stats.counts as Record<string, number> }
      : null,
    eventLog: st.eventLog,
    decisions: st.decisionStream,
    creatures: st.creatures,
    reflectVerdict: st.reflectVerdict?.verdict ?? null,
    breakerOpen,
    quantActive: st.lastQuant !== null,
    quantVolatility: volatility,
    quantAllocations: st.lastQuant?.allocations.length ?? 0,
    now: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Persist helper (vault settings lokal)
// ---------------------------------------------------------------------------

export async function persistCreatures(): Promise<void> {
  const { setSetting } = await import("../vault");
  await setSetting("organism.creatures", useFlybrain.getState().creatures);
}

export { PULSE_INTERVAL_MS };

// recompile-touch 1790008447
