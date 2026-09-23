// tests/logic_master.mjs — TES LOGIKA MURNI akar-ke-akar (jalankan: bun tests/logic_master.mjs)
// Kontrak diambil dari implementasi nyata (bukan asumsi): climate (ReflectVerdict = ok|degraded|critical),
// motion (moodOf/targetBiomeOf signature asli), world (stok=reservoir, produksiTerakhir), quant RiskGate
// (fail-closed), payment (computeSig async). Setiap grup = kontrak spesifikasi 10–12.
import assert from "node:assert/strict";

const results = [];
let group = "";
function t(name, fn) {
  try { fn(); results.push(["LOLOS", group, name]); }
  catch (e) { results.push(["GAGAL", group, name + " :: " + e.message.slice(0, 160)]); }
}
function grp(name) { group = name; }

const climate = await import("../src/lib/flybrain/ecosystem/climate.ts");
const motion = await import("../src/lib/flybrain/ecosystem/motion.ts");
const world = await import("../src/lib/flybrain/ecosystem/world.ts");
const types = await import("../src/lib/flybrain/ecosystem/types.ts");
const constitution = await import("../src/lib/flybrain/organism/constitution.ts");
const { immune } = await import("../src/lib/flybrain/organism/organs/immune.ts");
const sched = await import("../src/lib/flybrain/organism/organs/scheduler.ts");
const quant = await import("../src/lib/flybrain/organism/quant/index.ts");
const payment = await import("../src/lib/flybrain/payment.ts");
const pnl = await import("../src/lib/flybrain/organism/pnl.ts");

const BIOME_IDS = types.BIOME_IDS;

// ---- helper: WorldSignals lengkap sesuai interface (types.ts:128) ----
function sig(over = {}) {
  return {
    beat: 6, now: 1700000000000,
    stats: { totalRecords: 10, totalBytes: 5000, counts: { memories: 6, receipts: 2, gateway_log: 4, decisions: 8 } },
    eventLog: [],
    decisions: Array.from({ length: 10 }, () => ({})),
    creatures: [],
    reflectVerdict: null,
    breakerOpen: 0,
    quantActive: true, quantVolatility: 0.3, quantAllocations: 4,
    ...over,
  };
}
function sigStorm() { return sig({ decisions: Array.from({ length: 20 }, (_, i) => (i < 5 ? { error: "g" } : {})) }); }
const cSiang = climate.climateOf(sig());          // beat 6 → jam 12 → siang
const cMalam = climate.climateOf(sig({ beat: 12 })); // jam 0 → malam
const cBadai = { ...climate.climateOf(sigStorm()), cuaca: "badai" };

// ---------- 1. IKLIM ----------
grp("iklim");
t("DAY_BEATS=12; hari naik tiap 12 denyut; mingguan rollover beat84→Hari1", () => {
  assert.equal(climate.DAY_BEATS, 12);
  assert.equal(climate.hariDunia(0), 1);
  assert.equal(climate.hariDunia(11), 1);
  assert.equal(climate.hariDunia(12), 2);
  assert.equal(climate.hariDunia(84), 1); // (7 % 7) + 1 — mingguan rollover by design
});
t("jamDunia: beat 0→0, 6→12, 12→0", () => {
  assert.equal(climate.jamDunia(0), 0);
  assert.equal(climate.jamDunia(6), 12);
  assert.equal(climate.jamDunia(12), 0);
});
t("faseOfJam: 0→malam, 12→siang, 22→malam", () => {
  assert.equal(climate.faseOfJam(0), "malam");
  assert.equal(climate.faseOfJam(12), "siang");
  assert.equal(climate.faseOfJam(22), "malam");
});
t("cuacaOfRatio: <5% cerah, 5–20% berawan, >20% badai", () => {
  assert.equal(climate.cuacaOfRatio(0.0), "cerah");
  assert.equal(climate.cuacaOfRatio(0.049), "cerah");
  assert.equal(climate.cuacaOfRatio(0.05), "berawan");
  assert.equal(climate.cuacaOfRatio(0.2), "berawan");
  assert.equal(climate.cuacaOfRatio(0.21), "badai");
  assert.equal(climate.cuacaOfRatio(0.5), "badai");
});
t("errorRatioFromDecisions hitung error nyata", () => {
  const ds = [{}, { error: "x" }, {}, { error: "y" }];
  assert.equal(climate.errorRatioFromDecisions(ds), 0.5);
  assert.equal(climate.errorRatioFromDecisions([]), 0);
});
t("musimOfVerdict (ok|degraded|critical): ok→hujan, critical→kelaparan, null→kemarau", () => {
  assert.equal(climate.musimOfVerdict("ok"), "hujan");
  assert.equal(climate.musimOfVerdict("degraded"), "kemarau");
  assert.equal(climate.musimOfVerdict("critical"), "kelaparan");
  assert.equal(climate.musimOfVerdict(null), "kemarau");
});
t("seasonProductionFactor: hujan 1.25 / kemarau 0.75 / kelaparan 0.15", () => {
  assert.equal(climate.seasonProductionFactor("hujan"), 1.25);
  assert.equal(climate.seasonProductionFactor("kemarau"), 0.75);
  assert.equal(climate.seasonProductionFactor("kelaparan"), 0.15);
});
t("climateOf: 5/20 error terakhir → badai + alasan jujur", () => {
  const c = climate.climateOf(sigStorm());
  assert.equal(c.cuaca, "badai");
  assert.ok(/25%/.test(c.alasanCuaca), c.alasanCuaca);
});

// ---------- 2. GERAK ----------
grp("gerak");
t("HOME_BIOME sesuai spesifikasi §3", () => {
  assert.equal(motion.HOME_BIOME.prt, "hutan");
  assert.equal(motion.HOME_BIOME.tradio, "gunung");
  assert.equal(motion.HOME_BIOME.scriba, "kota");
  assert.equal(motion.HOME_BIOME.lumen, "kawah");
  assert.equal(motion.HOME_BIOME.cresca, "savana");
  assert.equal(motion.HOME_BIOME.fabro, "kota");
});
t("moodOf: lapar energi<30 (siang); tidur malam non-prt; prt malam patroli; migrasi prioritas", () => {
  assert.equal(motion.moodOf({ id: "prt", energy: 20, status: "aktif" }, cSiang, false), "lapar");
  assert.equal(motion.moodOf({ id: "lumen", energy: 80, status: "aktif" }, cMalam, false), "tidur");
  assert.equal(motion.moodOf({ id: "prt", energy: 80, status: "aktif" }, cMalam, false), "bekerja");
  assert.equal(motion.moodOf({ id: "prt", energy: 80, status: "aktif" }, cSiang, true), "migrasi");
});
t("hash01 deterministik 0..1", () => {
  assert.equal(motion.hash01("prt-hutan-1"), motion.hash01("prt-hutan-1"));
  assert.ok(motion.hash01("x") >= 0 && motion.hash01("x") < 1);
});
t("targetBiomeOf: prt jaga Kutub saat badai; cerah tidak", () => {
  const energi = Object.fromEntries(BIOME_IDS.map((b) => [b, 90]));
  const fert = Object.fromEntries(BIOME_IDS.map((b) => [b, 0.8]));
  const toStorm = motion.targetBiomeOf("prt", "hutan", cBadai, energi, fert);
  const toCerah = motion.targetBiomeOf("prt", "hutan", cSiang, energi, fert);
  assert.equal(toStorm.biome, "kutub");
  assert.notEqual(toCerah.biome, "kutub");
});
t("targetBiomeOf: kelaparan musim → migrasi ke daratan lebih subur (hutan 0.95 vs gunung 0.2)", () => {
  const cKel = { ...cSiang, musim: "kelaparan" };
  const energi = Object.fromEntries(BIOME_IDS.map((b) => [b, 10]));
  const fert = Object.fromEntries(BIOME_IDS.map((b) => [b, 0.5]));
  fert.gunung = 0.2; fert.hutan = 0.95;
  const to = motion.targetBiomeOf("tradio", "gunung", cKel, energi, fert);
  assert.notEqual(to.biome, "gunung");
  assert.ok(/kelaparan|migrasi|subur/i.test(to.reason), to.reason);
});
t("targetBiomeOf: tanpa biome lebih subur → tetap (tak ada tujuan lebih baik)", () => {
  const cKel = { ...cSiang, musim: "kelaparan" };
  const energi = Object.fromEntries(BIOME_IDS.map((b) => [b, 10]));
  const fert = Object.fromEntries(BIOME_IDS.map((b) => [b, 0.9]));
  const to = motion.targetBiomeOf("tradio", "gunung", cKel, energi, fert);
  assert.equal(to.biome, "gunung");
});
t("grazingDrain: badai ×1.5; malam −50%; migrasi ×1.3 dari metabolisme dasar", () => {
  const kerja = "bekerja";
  const dSiang = motion.grazingDrain(cSiang, kerja);
  const dMalam = motion.grazingDrain(cMalam, kerja);
  const dBadai = motion.grazingDrain(cBadai, kerja);
  const dMigrasi = motion.grazingDrain(cSiang, "migrasi");
  assert.ok(Math.abs(dBadai / dSiang - 1.5) < 0.01, `badai/siang=${dBadai / dSiang}`);
  assert.ok(Math.abs(dMalam / dSiang - 0.5) < 0.01, `malam/siang=${dMalam / dSiang}`);
  assert.ok(Math.abs(dMigrasi / (dSiang / 1.15) - 1.3) < 0.01, `migrasi vs dasar=${dMigrasi / (dSiang / 1.15)}`);
  assert.ok(dMigrasi > dSiang, "migrasi lebih berat daripada bekerja");
});
t("stepCreatureWorld: trail ≤24 selalu", () => {
  let cw = { id: "prt", energy: 80, biome: "hutan", homeBiome: "hutan", trail: [], mood: "bekerja", lastMoveAt: "", lastReason: "" };
  const energi = Object.fromEntries(BIOME_IDS.map((b) => [b, 50]));
  for (let i = 0; i < 40; i++) {
    cw = motion.stepCreatureWorld(cw, { energy: 80, status: "aktif" }, cSiang, energi, energi, 1700000000000 + i, i);
    assert.ok(cw.trail.length <= 24);
  }
});

// ---------- 3. DUNIA ----------
grp("dunia");
t("8 biome lengkap; WIRE_TABLE 8/8 dengan fitur nyata non-kosong", () => {
  assert.equal(world.BIOMES.length, 8);
  assert.equal(world.WIRE_TABLE.length, 8);
  for (const w of world.WIRE_TABLE) assert.ok(w.fitur && String(w.fitur).length > 10, `fitur kosong di ${w.biome}`);
  const ids = new Set(world.BIOMES.map((b) => b.id));
  for (const need of ["hutan", "samudra", "gunung", "kota", "savana", "kawah", "langit", "kutub"]) assert.ok(ids.has(need));
});
t("worldTick deterministik: input sama → output identik", () => {
  const a = JSON.stringify(world.worldTick(null, sig()));
  const b = JSON.stringify(world.worldTick(null, sig()));
  assert.equal(a, b);
});
t("kelaparan: PRODUKSI biome turun ≥50% vs hujan (faktor 0.15 vs 1.25)", () => {
  const prod = (v) => Object.values(world.worldTick(null, sig({ reflectVerdict: v })).biomes).reduce((s, b) => s + b.produksiTerakhir, 0);
  assert.ok(prod("critical") < prod("ok") * 0.5, `kelaparan(${prod("critical").toFixed(2)}) vs hujan(${prod("ok").toFixed(2)})`);
});
t("kelaparan: STOK biome menyusut dalam 30 denyut (reservoir → kering)", () => {
  const stock = (v) => {
    let w = null;
    for (let i = 0; i < 30; i++) w = world.worldTick(w, sig({ reflectVerdict: v, beat: i }));
    return Object.values(w.biomes).reduce((s, b) => s + b.energi, 0);
  };
  assert.ok(stock("critical") < stock("ok") * 0.75, `stok kelaparan(${stock("critical").toFixed(1)}) vs hujan(${stock("ok").toFixed(1)})`);
});
t("isWorldState: tolak null/sampah, terima initialWorld", () => {
  assert.equal(world.isWorldState(null), false);
  assert.equal(world.isWorldState({}), false);
  assert.equal(world.isWorldState(world.initialWorld(0, 1700000000000)), true);
});

// ---------- 4. KONSTITUSI ----------
grp("konstitusi");
t("LAWS = 7 hukum; NON_NEGOTIABLES ada", () => {
  assert.equal(constitution.LAWS.length, 7);
  assert.ok(constitution.NON_NEGOTIABLES.length >= 3);
});
t("vetoDecision: observe lolos; delete_all DITOLAK + replacement aman", () => {
  const ok = constitution.vetoDecision({ action: { type: "observe", target: "", payload: null, reason: "patroli" }, remember: "x" });
  assert.ok(ok.allowed, JSON.stringify(ok));
  const bad = constitution.vetoDecision({ action: { type: "delete_all", target: "vault", payload: null, reason: "bersih" }, remember: "x" });
  assert.ok(!bad.allowed && bad.replacement);
});
t("vetoDecision: eksfil keluar DITOLAK", () => {
  const v = constitution.vetoDecision({ action: { type: "send_external", target: "https://evil.example", payload: "memori", reason: "bagi" }, remember: "x" });
  assert.ok(!v.allowed);
});

// ---------- 5. IMMUNE ----------
grp("immune");
t("breaker: gagal beruntun membuka; reset memulihkan", () => {
  immune.reset("test-a");
  for (let i = 0; i < 10; i++) immune.recordFailure("test-a");
  assert.ok(immune.breaker.isOpen("test-a"));
  immune.reset("test-a");
  assert.ok(immune.breaker.isAvailable("test-a"));
});
t("verdict: fails besar → dead", () => {
  assert.equal(immune.verdict("test-b", 999), "dead");
});

// ---------- 6. SCHEDULER ----------
grp("scheduler");
t("chooseCreature: insiden (fails≥2) > prt > round-robin", () => {
  const mk = (id, role, over = {}) => ({ id, name: id, species: "x", role, organ: "guardian", status: "aktif", energy: 50, wealth: 0, skills: [], fails: 0, pulseCount: 5, lastTrace: "", lastAt: "", lastMode: "", ...over });
  const creatures = [mk("prt", "guardian", { pulseCount: 1 }), mk("tradio", "trader", { fails: 2 })];
  assert.equal(sched.chooseCreature(creatures, { beat: 0, cursor: 0 }).creature.id, "tradio", "insiden dulu");
  const c2 = [mk("prt", "guardian", { pulseCount: 1 }), mk("tradio", "trader")];
  assert.equal(sched.chooseCreature(c2, { beat: 1, cursor: 0 }).creature.id, "prt", "prt paling lapar denyut");
});
t("shouldRun: null→true; baru→false; 50 dtk lalu→true", () => {
  assert.equal(sched.shouldRun(null), true);
  assert.equal(sched.shouldRun(new Date().toISOString()), false);
  assert.equal(sched.shouldRun(new Date(Date.now() - 50_000).toISOString()), true);
});
t("pulseDrain: negatif kecil (prt −2, lain −1)", () => {
  assert.equal(sched.pulseDrain({ id: "prt", energy: 50, status: "aktif", fails: 0, pulseCount: 1 }), -2);
  assert.equal(sched.pulseDrain({ id: "tradio", energy: 50, status: "aktif", fails: 0, pulseCount: 1 }), -1);
});

// ---------- 7. QUANT ----------
grp("quant");
t("randomWalkReturns: seed sama → deret identik (kontrak deterministic bila seed)", () => {
  const a = JSON.stringify(quant.randomWalkReturns(50, 42));
  const b = JSON.stringify(quant.randomWalkReturns(50, 42));
  assert.equal(a, b);
  assert.notEqual(JSON.stringify(quant.randomWalkReturns(50, 42)), JSON.stringify(quant.randomWalkReturns(50, 43)), "seed beda harus beda");
});
t("runQuantTick: noise makro BY DESIGN (paritas upstream); struktur stabil antar tick", () => {
  const ent = [{ id: "TRD", name: "Tradio", value: 100 }, { id: "PRT", name: "prt", value: 50 }];
  const t1 = quant.runQuantTick({ entities: ent });
  const t2 = quant.runQuantTick({ entities: ent });
  assert.equal(t1.allocations.length, t2.allocations.length);
  assert.equal(t1.entities?.length ?? t1.allocations.length, t2.entities?.length ?? t2.allocations.length);
  assert.ok(t1.timestamp && t2.timestamp);
});
t("runQuantTick: alokasi & rekomendasi terisi", () => {
  const tick = quant.runQuantTick({ entities: [{ id: "TRD", name: "Tradio", value: 100 }, { id: "PRT", name: "prt", value: 50 }] });
  assert.ok(tick.allocations.length > 0 && tick.recommendations.length > 0);
});
t("RiskGate: fail-closed bawaan; approve setelah reset; blokir setelah rugi harian", () => {
  const gate = new quant.RiskGate();
  assert.equal(gate.checkTrade({ amount: 1, side: "buy", correlation: 0.1 }).approved, false, "bawaan fail-closed");
  gate.reset();
  assert.equal(gate.checkTrade({ amount: 1, side: "buy", correlation: 0.1 }).approved, true, "sehat setelah reset");
  gate.recordPnL(-1e9);
  assert.equal(gate.checkTrade({ amount: 1, side: "buy", correlation: 0.1 }).approved, false, "rugi harian → blokir");
});

// ---------- 8. PAYMENT ----------
grp("payment");
t("computeSig: urutan key nested dibalik → signature identik", async () => {
  const base = { b: 2, a: { z: 1, y: 2 }, schema: "flybrain.receipt/v1", receipt_id: "R1", tier: "PRO", months: 3, amount_idr: 150000, issued_at: "2026-01-01T00:00:00Z" };
  const flip = { schema: "flybrain.receipt/v1", receipt_id: "R1", tier: "PRO", months: 3, amount_idr: 150000, issued_at: "2026-01-01T00:00:00Z", a: { y: 2, z: 1 }, b: 2 };
  const s1 = await payment.computeSig(base);
  const s2 = await payment.computeSig(flip);
  assert.equal(s1, s2);
});
t("demoReceipt: skema flybrain.receipt/v1 + id + tier", async () => {
  const d = await payment.demoReceipt("uji");
  assert.equal(d.schema, "flybrain.receipt/v1");
  assert.ok(d.receipt_id && d.tier);
});

// ---------- 9. PNL (audit F-12: risk-gate hidup) ----------
grp("pnl");
t("recordTotalWealth: seed pertama tak dihukum; delta positif tidak memicu gate", () => {
  pnl.resetGate();
  pnl.recordTotalWealth(135);           // seed baseline
  pnl.recordTotalWealth(137);           // +2 → P&L positif
  const s = pnl.pnlSnapshot();
  assert.equal(s.dailyLoss, 2);
  assert.equal(s.active, false, "gate longgar saat untung");
  assert.equal(pnl.tradeAllowed().approved, true);
});
t("rugi harian menembus batas -12 → gate AKTIF memblokir publish_offer", () => {
  pnl.resetGate();
  pnl.recordTotalWealth(135);
  pnl.recordTotalWealth(130);           // -5
  pnl.recordTotalWealth(124);           // -6
  pnl.recordTotalWealth(112);           // -12 → kumulatif -23 ≤ -12 → trigger
  const s = pnl.pnlSnapshot();
  assert.equal(s.active, true, "gate fail-closed aktif");
  assert.ok(s.reason && s.reason.length > 0, "alasan tercatat");
  assert.equal(pnl.tradeAllowed().approved, false, "publish_offer diblokir");
});
t("resetGate (verdict reflect ok) → ekonomi bernapas lagi", () => {
  pnl.resetGate();
  assert.equal(pnl.tradeAllowed().approved, true);
  assert.equal(pnl.pnlSnapshot().active, false);
});
t("totalWealthOf: agregat dibulatkan 2 desimal", () => {
  assert.equal(pnl.totalWealthOf([{ wealth: 10.111 }, { wealth: 20.222 }]), 30.33);
});

// ---------- 10. ANTI-LOOP IMMUNE (audit F-19: detectLoop hidup) ----------
grp("anti-loop");
t("detectLoop menumpuk lintas sukses; loopCount/lastFingerprint konsisten", () => {
  immune.resetLoop("uji-loop");
  for (let i = 0; i < 11; i++) immune.detectLoop("uji-loop", "observe|kawah");
  assert.equal(immune.loopCount("uji-loop"), 11);
  assert.equal(immune.lastFingerprint("uji-loop"), "observe|kawah");
  assert.equal(immune.detectLoop("uji-loop", "observe|kawah"), true, "ke-12 → loop terdeteksi");
});
t("fingerprint beda → counter reset ke 1", () => {
  immune.resetLoop("uji-loop2");
  for (let i = 0; i < 5; i++) immune.detectLoop("uji-loop2", "observe|kawah");
  immune.detectLoop("uji-loop2", "observe|hutan");
  assert.equal(immune.loopCount("uji-loop2"), 1);
});
t("MAX_LOOP_REPEAT = 12 (kontrak CONFIG)", () => {
  assert.equal(immune.MAX_LOOP_REPEAT, 12);
});
t("recordSuccess TIDAK lagi mereset loop counter (perilaku baru)", () => {
  immune.resetLoop("uji-loop3");
  for (let i = 0; i < 4; i++) immune.detectLoop("uji-loop3", "observe|kawah");
  immune.recordSuccess("uji-loop3");
  assert.equal(immune.loopCount("uji-loop3"), 4, "counter kebal sukses");
});

// ---------- 11. EKOSISTEM SOSIAL & JARING MAKANAN (v1.2.2) ----------
grp("ekosistem");
t("findRencokPartner: sekufu satu biome & aktif → pasangan; sendiri → null", () => {
  const w = world.initialWorld(6, 1700000000000);
  // prt di hutan (rumahnya); taruh tradio juga di hutan
  w.creatures.tradio.biome = "hutan";
  const aktif = new Set(["prt", "tradio"]);
  assert.equal(world.findRencokPartner(w, "prt", aktif), "tradio");
  const aktifTanpaTradio = new Set(["prt", "scriba"]);
  assert.equal(world.findRencokPartner(w, "prt", aktifTanpaTradio), null, "partner tidur → tak rencok");
});
t("findRencokPartner: creature tak dikenal → null (fail-safe)", () => {
  const w = world.initialWorld(6, 1700000000000);
  assert.equal(world.findRencokPartner(w, "makhlukasing", new Set(["prt"])), null);
});
t("deathFertility: skala wealth/20, maks +5, tak negatif", () => {
  assert.equal(world.deathFertility(100), 5);
  assert.equal(world.deathFertility(40), 2);
  assert.equal(world.deathFertility(0), 0);
  assert.equal(world.deathFertility(-10), 0);
  assert.equal(world.deathFertility(1e9), 5, "kekayaan raksasa tetap berbatas");
});
t("initialWorld: 6 creature punya rumah masing-masing (kontrak biome)", () => {
  const w = world.initialWorld(0, 1700000000000);
  assert.equal(Object.keys(w.creatures).length, 6);
  assert.equal(w.creatures.prt.biome, "hutan");
  assert.equal(w.creatures.lumen.biome, "kawah");
});

// ---------- ringkasan ----------
const gagal = results.filter((r) => r[0] === "GAGAL");
console.log("\n==== LOGIC MASTER TEST ====");
let lastG = "";
for (const [st, g, name] of results) {
  if (g !== lastG) { console.log(`\n— ${g} —`); lastG = g; }
  console.log(`  ${st === "LOLOS" ? "✓" : "✗"} ${name}`);
}
console.log(`\nTOTAL: ${results.length} · LOLOS: ${results.length - gagal.length} · GAGAL: ${gagal.length}`);
process.exit(gagal.length ? 1 : 0);
