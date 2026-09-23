// tests/e2e_master.mjs — E2E REAL-TIME via puppeteer-core + Chrome ber-cache.
// Klik SEMUA halaman (00–08) & fitur utama, uji sambungan front→back, tangkap pageerror.
// Jalankan: node tests/e2e_master.mjs  (dev server harus hidup di :3000)
import puppeteer from "puppeteer-core";
import crypto from "node:crypto";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOT = "/home/z/my-project/tool-results/e2e";
fs.mkdirSync(SHOT, { recursive: true });

const CHROME = "/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome";
const results = [];
const pageErrors = [];
let stepN = 0;

function ok(name, cond, extra = "") {
  results.push([cond ? "LOLOS" : "GAGAL", ++stepN, name + (cond ? "" : ` :: ${extra}`)]);
  console.log(`${cond ? "✓" : "✗"} [${stepN}] ${name}${cond ? "" : ` :: ${extra}`}`);
  return cond;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e?.message || e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") pageErrors.push("console: " + m.text().slice(0, 200)); });

  const shot = (name) => page.screenshot({ path: `${SHOT}/${String(stepN + 1).padStart(2, "0")}_${name}.png` }).catch(() => {});
  const navTo = async (code, label) => {
    await page.evaluate((c) => {
      const nav = document.querySelector('nav[aria-label="Navigasi utama"]');
      const btn = [...nav.querySelectorAll("button")].find((b) => b.textContent.includes(c));
      btn.click();
    }, code);
    await sleep(900); // tunggu kompilasi/render view
  };
  const text = () => page.evaluate(() => document.body.innerText);

  // ---------- 1. LANDING ----------
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1200);
  ok("Landing render — judul 'Satu sambungan'", (await text()).includes("Satu sambungan"));
  ok("AppShell nav utama ada", await page.$('nav[aria-label="Navigasi utama"]') !== null);
  ok("Ticker versi v1.2 PLANET", (await text()).includes("v1.2"));
  await shot("landing");

  // ---------- 2. KENDALI (00) ----------
  await navTo("00");
  ok("00 Kendali — hero + CTA", (await text()).includes("PROYEK A"));
  ok("00 — pesan identitas lokal", (await text()).includes("IDENTITAS"));
  await shot("kendali");

  // ---------- 3. OTAK (01) ----------
  await navTo("01");
  ok("01 Otak — kanvas saraf", (await page.$$("canvas")).length >= 1);
  await shot("otak");

  // ---------- 4. PRT (02) chat ----------
  await navTo("02");
  await page.type('input[aria-label="Pesan untuk PRT"]', "Status sarang hari ini, prt?", { delay: 10 });
  await page.click('button[aria-label="Kirim pesan"]');
  let replied = false;
  for (let i = 0; i < 40; i++) { await sleep(500); replied = (await text()).match(/Laporan|refleks|Budget|energi|memori/i); if (replied) break; }
  ok("02 PRT — chat terjawab (LLM/refleks/budget jujur)", Boolean(replied));
  await shot("prt");

  // ---------- 5. VAULT (03): identitas + memori CRUD (regresi F-01) ----------
  await navTo("03");
  const u = `e2e_${Date.now().toString(36)}`;
  await page.type('input[aria-label="Username"]', u, { delay: 5 });
  await page.type('input[aria-label="Password"]', "rahasia-e2e-123", { delay: 5 });
  const mk = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Buat identitas lokal")));
  await mk.asElement().click();
  let ident = false;
  for (let i = 0; i < 20; i++) { await sleep(300); ident = (await text()).includes(`username:`); if (ident) break; }
  ok("03 Vault — identitas lokal dibuat", ident);
  await page.type('input[aria-label="Judul memori"]', "Memori E2E", { delay: 5 });
  await page.type('textarea[aria-label="Isi memori"]', "Dibuat otomatis oleh e2e_master — uji CRUD vault.", { delay: 5 });
  const simpan = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Simpan"));
  await simpan.asElement().click();
  await sleep(1200);
  let hapusCount = await page.evaluate(() => document.querySelectorAll('button[aria-label^="Hapus memori"]').length);
  ok("03 Vault — memori baru muncul di daftar", hapusCount >= 1, `hapus=${hapusCount}`);
  // REGRESI F-01: klik HAPUS harus benar-benar menghapus (dulu ReferenceError)
  await page.click('button[aria-label^="Hapus memori"]');
  await sleep(1500);
  const hapusAfter = await page.evaluate(() => document.querySelectorAll('button[aria-label^="Hapus memori"]').length);
  ok("03 Vault — HAPUS memori berfungsi (fix F-01 terverifikasi)", hapusAfter === hapusCount - 1, `sebelum=${hapusCount} sesudah=${hapusAfter}`);
  await shot("vault");

  // ---------- 6. GERBANG (04) ----------
  await navTo("04");
  ok("04 Gerbang — katalog 9 tools dinamis", (await text()).includes("9 tools"));
  ok("04 Gerbang — panduan Hermes/curl", (await text()).includes("Hermes"));
  await shot("gerbang");

  // ---------- 7. DOKUMEN (05) ----------
  await navTo("05");
  ok("05 Dokumen — daftar dokumen render", /PRD|ARSITEKTUR|AUTONOMY|CHANGELOG/.test(await text()));
  await shot("dokumen");

  // ---------- 8. RUANG KENDALI (06): JSON-RPC tester ----------
  await navTo("06");
  ok("06 Ruang Kendali — panel mandat otonomi", /mandat/i.test(await text()));
  ok("06 — aliran keputusan", /aliran keputusan/i.test(await text()));
  await page.click('button[aria-label="Method JSON-RPC"], select[aria-label="Method JSON-RPC"]').catch(() => {});
  const kirim = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("KIRIM")));
  await kirim.asElement().click();
  let rpc = false;
  for (let i = 0; i < 20; i++) { await sleep(400); rpc = (await text()).includes("protocolVersion"); if (rpc) break; }
  ok("06 — JSON-RPC tester initialize → protocolVersion", rpc);
  await shot("ruang");

  // ---------- 9. BIOSFER (07): 6 creature + denyut ----------
  await navTo("07");
  const chips = await page.evaluate(() => {
    const t = document.body.innerText.toLowerCase();
    return ["prt", "tradio", "scriba", "lumen", "cresca", "fabro"].filter((n) => t.includes(n)).length;
  });
  ok("07 BIOSFER — 6 creature terdaftar", chips === 6, `terlihat=${chips}/6`);
  const pulseB = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => /PICU DENYUT/.test(b.textContent)));
  await pulseB.asElement().click();
  let decided = false;
  for (let i = 0; i < 40; i++) { await sleep(500); decided = (await text()).match(/MENALAR|REFLEKS/); if (decided) break; }
  ok("07 BIOSFER — denyut menghasilkan keputusan (menalar/refleks)", Boolean(decided));
  await shot("biosfer");

  // ---------- 10. PLANET (08): peta dunia hidup ----------
  await navTo("08");
  ok("08 PLANET — kanvas peta dunia", await page.$('canvas[aria-label^="Peta dunia PLANET"]') !== null);
  ok("08 — judul peta + wire table", (await text()).includes("PETA SISTEM") || (await text()).includes("PETA PLANET"));
  const planetChips = await page.evaluate(() => [...document.querySelectorAll('[aria-label*="mood"]')].length);
  ok("08 — 6 makhluk di peta", planetChips >= 6, `chips=${planetChips}`);
  const prtc = await page.evaluateHandle(() => [...document.querySelectorAll('[aria-label*="mood"]')].find((el) => el.getAttribute("aria-label").startsWith("prt")));
  if (prtc.asElement()) { await prtc.asElement().click(); await sleep(700); }
  ok("08 — inspektor creature prt terbuka", (await text()).includes("Inspektor creature prt") || (await text()).includes("GENOM") || /energi/i.test(await text()));
  const pulseP = await page.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("PICU DENYUT DUNIA")));
  await pulseP.asElement().click();
  let worldBeat = false;
  for (let i = 0; i < 30; i++) { await sleep(500); const t = await text(); worldBeat = /Hari \d|cuaca|musim/i.test(t) && !/BELUM BERDENYUT/.test(t); if (worldBeat) break; }
  ok("08 — dunia berdenyut (iklim hidup)", worldBeat);
  await shot("planet");

  // ---------- 11. API FRONT→BACK via page.evaluate ----------
  const api = await page.evaluate(async () => {
    const post = (body, headers = {}) => fetch("/api/mcp", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => null) }));
    const init = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    const list = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const world = await post({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "world.map", arguments: {} } });
    const bad = await post({ jsonrpc: "2.0", id: 4, method: "tidak.ada" });
    const badp = await post({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { arguments: {} } });
    const envelope = await post({ id: 6, method: "initialize" }); // tanpa jsonrpc:2.0 → F-16
    const hb = await fetch("/api/organism/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organ: "guardian", sensePacket: "e2e sense packet uji sambungan front-back" }) }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => null) }));
    return { init, tools: list.j?.result?.tools, worldOk: world.j?.result != null, badCode: bad.j?.error?.code, badpCode: badp.j?.error?.code, envCode: envelope.j?.error?.code, hbStatus: hb.status, hbKeys: hb.j ? Object.keys(hb.j) : [] };
  });
  ok("API initialize → protocolVersion 2025-06-18", api.init?.j?.result?.protocolVersion === "2025-06-18", JSON.stringify(api.init).slice(0, 120));
  ok("API tools/list = 9 tools", Array.isArray(api.tools) && api.tools.length === 9, `n=${api.tools?.length}`);
  ok("API tools/call world.map → result ada", api.worldOk === true);
  ok("API method tak dikenal → -32601", api.badCode === -32601, `code=${api.badCode}`);
  ok("API tools/call tanpa nama → -32602", api.badpCode === -32602, `code=${api.badpCode}`);
  ok("API envelope tanpa jsonrpc:2.0 → -32600 (fix F-16)", api.envCode === -32600, `code=${api.envCode}`);
  ok("API heartbeat organ guard → 200", api.hbStatus === 200, `status=${api.hbStatus} keys=${api.hbKeys}`);

  // ---------- 12. Bearer end-to-end: FK1_ dari identitas vault ----------
  const key = `FK1_${crypto.createHash("sha256").update(`${u}|rahasia-e2e-123`).digest("hex")}`;
  const bearer = await page.evaluate(async (k) => {
    const r = await fetch("/api/mcp", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${k}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "system.status", arguments: {} } }) });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, key);
  ok("API bearer FK1_ diterima (gema kunci di system.status)", bearer.status === 200 && JSON.stringify(bearer.body).includes("FK1_"), `status=${bearer.status}`);

  // ---------- 13. MOBILE 390px ----------
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(1000);
  ok("Mobile 390px — nav bawah tampil", await page.$('nav[aria-label="Navigasi utama mobile"]') !== null);
  await shot("mobile");

  await browser.close();

  // ---------- ringkasan ----------
  const gagal = results.filter((r) => r[0] === "GAGAL");
  console.log(`\n==== E2E MASTER ====  TOTAL: ${results.length} · LOLOS: ${results.length - gagal.length} · GAGAL: ${gagal.length}`);
  const realErrors = pageErrors.filter((e) => !/favicon|Download the React DevTools/i.test(e));
  console.log(`PageErrors: ${realErrors.length}${realErrors.length ? " — " + realErrors.join(" | ") : " (bersih)"}`);
  if (gagal.length) console.log("GAGAL:\n" + gagal.map((g) => `  ✗ [${g[1]}] ${g[2]}`).join("\n"));
  process.exit(gagal.length || realErrors.length ? 1 : 0);
}

main().catch((e) => { console.error("E2E fatal:", e); process.exit(2); });
