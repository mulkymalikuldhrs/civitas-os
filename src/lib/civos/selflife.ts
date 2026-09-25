// CIVITAS OS — selflife.ts (SLICE 11 — SELF BACKUP · SELF SYNC · SELF LIFE)
// Peradaban yang menjaga DIRINYA SENDIRI:
//   backupAll()  → arsip world + database + config → tar.gz ber-manifest (sha256) + retensi.
//   gitSync()    → add/commit/push ke 4 remote (GitHub x3 + GitLab) dengan token transient
//                  dari /home/z/.gitcreds (chmod 600, DI LUAR repo) — token tak pernah masuk git.
//   doctor()     → pemeriksaan menyeluruh: DB, server, backup, git, disk, rahasia bocor.
//   selfLifeTick()→ satu detak kehidupan: watchdog server autoStart + denyut peradaban +
//                  backup/sync sesuai jadwal config. Dipakai daemon + cron + UI.
// REALITY WINS: setiap hasil adalah pengukuran nyata; kegagalan dilaporkan jujur per-item.

import { execFile, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { emit } from "./events";
import { EVENT_TYPES } from "./types";
import { getConfigValue } from "./config";
import { watchdogServers, writeServerStatusCache } from "./servers";
import { heartbeatTick } from "./runtime";

const ROOT = "/home/z/my-project";
const BACKUP_DIR = path.join(ROOT, "backups");
const KV_LAST_BACKUP = "selflife.lastBackup";
const KV_LAST_SYNC = "selflife.lastSync";
const KV_LIFE = "selflife.lastTick";
const GITCREDS = "/home/z/.gitcreds";

const REMOTES: Array<{ name: string; url: string; tokenKey: string; ssh?: boolean }> = [
  { name: "gh-mulkymalikuldhrs", url: "https://github.com/mulkymalikuldhrs/civitas-os.git", tokenKey: "GH_MULKYMALIKULDHRS" },
  { name: "gh-mulkymalikuldhaher", url: "https://github.com/mulkymalikuldhaher/civitas-os.git", tokenKey: "GH_MULKYMALIKULDHAHER" },
  { name: "dhaher-labs", url: "https://github.com/dhaher-labs/civitas-os.git", tokenKey: "GH_DHAHERLABS" },
  // GitLab: HTTP edge anti-abuse tidak andal dari IP sandbox → jalur SSH altssh:443
  // (kunci ed25519 terdaftar di akun pemilik via API; wrapper GIT_SSH pure-JS tanpa klien ssh)
  { name: "gitlab", url: "ssh://git@altssh.gitlab.com:443/mulkymalikuldhr/civitas-os.git", tokenKey: "GL_TOKEN", ssh: true },
];

function sh(cmd: string, args: string[], timeoutMs = 120_000, cwd = ROOT, env?: Record<string, string>): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, cwd, env: { ...process.env, ...(env ?? {}) }, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      const code = err && typeof (err as { code?: number }).code === "number" ? (err as { code?: number }).code as number : err ? 1 : 0;
      resolve({ code, out: String(stdout).slice(-4000), err: String(stderr).slice(-4000) });
    });
  });
}

function sha256(file: string): string {
  const h = createHash("sha256");
  h.update(fs.readFileSync(file));
  return h.digest("hex");
}

// ---------- SELF BACKUP ----------

export interface BackupResult {
  ok: boolean;
  file?: string;
  bytes?: number;
  sha256?: string;
  kept?: number;
  detail: string;
  at: string;
}

export async function backupAll(): Promise<BackupResult> {
  const at = new Date().toISOString();
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const file = path.join(BACKUP_DIR, `civitas-${stamp}.tar.gz`);
    const targets: string[] = [];
    for (const rel of ["db/custom.db", "mc-server/pmmp/worlds", "mc-server/worlds", ".env"]) {
      if (fs.existsSync(path.join(ROOT, rel))) targets.push(rel);
    }
    if (!targets.length) return { ok: false, detail: "tidak ada target backup — db/world hilang?", at };
    const tar = await sh("tar", ["-czf", file, ...targets]);
    if (tar.code !== 0 || !fs.existsSync(file)) return { ok: false, detail: `tar gagal: ${tar.err || tar.out}`.slice(0, 300), at };
    // manifest + config snapshot
    const configRows = await db.civKV.findMany({ where: { key: { startsWith: "config." } } });
    const manifest = {
      at,
      kernel: "CIVITAS OS v1.1 SELF-LIFE",
      targets,
      bytes: fs.statSync(file).size,
      sha256: sha256(file),
      configKeys: configRows.length,
      note: "arsip dunia+db+config; config snapshot di tabel CivKV sumber — file ini bukti fisik",
    };
    fs.writeFileSync(path.join(BACKUP_DIR, `${path.basename(file)}.manifest.json`), JSON.stringify(manifest, null, 2));
    // retensi
    const keep = Math.max(1, Number((await getConfigValue("backup.keep")) || "7"));
    const all = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith("civitas-") && f.endsWith(".tar.gz")).sort();
    const stale = all.slice(0, Math.max(0, all.length - keep));
    for (const f of stale) {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f)); fs.unlinkSync(path.join(BACKUP_DIR, `${f}.manifest.json`)); } catch { /* sudah hilang */ }
    }
    await db.civKV.upsert({ where: { key: KV_LAST_BACKUP }, create: { key: KV_LAST_BACKUP, value: JSON.stringify({ at, file: path.basename(file), bytes: manifest.bytes, sha256: manifest.sha256 }) }, update: { value: JSON.stringify({ at, file: path.basename(file), bytes: manifest.bytes, sha256: manifest.sha256 }) } });
    await emit({ type: EVENT_TYPES.BACKUP_CREATED, subjectType: "KERNEL", subjectId: "backup", payload: { file: path.basename(file), bytes: manifest.bytes, kept: all.length - stale.length } });
    return { ok: true, file: path.basename(file), bytes: manifest.bytes, sha256: manifest.sha256, kept: all.length - stale.length, detail: `backup ${manifest.bytes} byte, retensi ${all.length - stale.length}/${keep}`, at };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "backup error", at };
  }
}

export function listBackups(): Array<{ file: string; bytes: number; sha256?: string; at: string }> {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("civitas-") && f.endsWith(".tar.gz"))
    .sort()
    .reverse()
    .map((f) => {
      const full = path.join(BACKUP_DIR, f);
      let meta: { sha256?: string; at?: string } = {};
      try { meta = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, `${f}.manifest.json`), "utf8")); } catch { /* manifest lama hilang — jujur tanpa sha */ }
      return { file: f, bytes: fs.statSync(full).size, sha256: meta.sha256, at: meta.at ?? new Date(fs.statSync(full).mtimeMs).toISOString() };
    });
}

// ---------- SELF RESTORE (v1.5 "CITADEL") ----------
// Mandat pemilik: "can restore via ui". Restore NYATA: verifikasi sha256 → stop server
// → ekstrak tar.gz ke akar project → start ulang server. Scope "worlds" hanya dunia;
// scope "full" termasuk DB kernel (memicu restart self-server agar Prisma membuka file baru).

export type RestoreScope = "worlds" | "full";

export interface RestoreResult {
  ok: boolean;
  file: string;
  scope: RestoreScope;
  detail: string;
  steps: string[];
  at: string;
}

function sanitizeBackupName(file: string): string | null {
  if (!file.startsWith("civitas-") || !file.endsWith(".tar.gz")) return null;
  if (file.includes("/") || file.includes("\\") || file.includes("..")) return null;
  return file;
}

/** Jadwalkan restart self-server (proses Next produksi) secara detached — watchdog membangkitkan. */
function scheduleSelfRestart(reason: string): void {
  try {
    const child = spawn("bash", ["-c", `sleep 3 && pkill -f 'next/dist/bin/next start' || true; pkill -f 'next start -p 3000' || true`], { detached: true, stdio: "ignore", cwd: ROOT });
    child.unref();
    console.log(`[restore] restart self-server dijadwalkan (${reason}) pid=${child.pid ?? "?"}`);
  } catch { /* watchdog tetap penjaga terakhir */ }
}

export async function restoreBackup(rawFile: string, scope: RestoreScope = "full"): Promise<RestoreResult> {
  const at = new Date().toISOString();
  const steps: string[] = [];
  const fail = (detail: string): RestoreResult => ({ ok: false, file: rawFile, scope, detail, steps, at });
  const file = sanitizeBackupName(rawFile);
  if (!file) return fail(`nama arsip tidak sah: ${rawFile.slice(0, 60)}`);
  const full = path.join(BACKUP_DIR, file);
  if (!fs.existsSync(full)) return fail(`arsip tidak ditemukan: ${file}`);

  // 1) verifikasi integritas (manifest sha256 bila ada)
  let expectSha = "";
  try { expectSha = (JSON.parse(fs.readFileSync(`${full}.manifest.json`, "utf8")) as { sha256?: string }).sha256 ?? ""; } catch { /* manifest lama */ }
  if (expectSha) {
    const actual = sha256(full);
    if (actual !== expectSha) return fail(`sha256 tidak cocok: arsip ${actual.slice(0, 12)}… vs manifest ${expectSha.slice(0, 12)}…`);
    steps.push(`sha256 cocok (${actual.slice(0, 12)}…)`);
  } else {
    steps.push("manifest sha256 tidak ada — lanjut tanpa verifikasi (jujur)");
  }

  // 2) stop server managed agar dunia tidak ditulis saat ditukar
  const { serverAction } = await import("./servers");
  for (const id of ["local-java", "local-bedrock"]) {
    const r = await serverAction(id, "stop").catch((e) => ({ ok: false, detail: String(e) }));
    steps.push(`stop ${id}: ${r.ok ? "ok" : "dilewati"}`);
  }

  // 3) ekstrak (scope worlds hanya mc-server/*; full semuanya)
  const args = scope === "worlds"
    ? ["-xzf", full, "-C", ROOT, "--wildcards", "mc-server/*"]
    : ["-xzf", full, "-C", ROOT];
  const ex = await sh("tar", args, 300_000);
  if (ex.code !== 0) return fail(`ekstrak gagal: ${(ex.err || ex.out).slice(0, 200)}`);
  steps.push(`ekstrak ${scope === "worlds" ? "dunia" : "penuh (dunia+db+config)"} ok`);

  // 4) start ulang server
  await new Promise((res) => setTimeout(res, 1500));
  for (const id of ["local-java", "local-bedrock"]) {
    const r = await serverAction(id, "start").catch((e) => ({ ok: false, detail: String(e) }));
    steps.push(`start ${id}: ${r.ok ? "ok" : "watchdog akan mencoba lagi"}`);
  }

  // 5) full → restart self-server agar Prisma membuka DB baru
  if (scope === "full") scheduleSelfRestart("restore full termasuk db/custom.db");

  await emit({
    type: EVENT_TYPES.BACKUP_RESTORED,
    subjectType: "KERNEL",
    subjectId: "restore",
    payload: { file, scope, steps },
  });
  return { ok: true, file, scope, detail: `restore ${scope} dari ${file} selesai (${steps.length} langkah)`, steps, at };
}

// ---------- SELF BACKUP CLOUD (v1.5) ----------

/** Unggah arsip lokal terbaru (atau nama tertentu) ke Supabase Storage. */
export async function backupToCloud(rawFile?: string): Promise<{ ok: boolean; detail: string; file?: string; at: string }> {
  const at = new Date().toISOString();
  try {
    const { storageEnsureBucket, storageUploadBackup } = await import("./supabase");
    const ensure = await storageEnsureBucket();
    if (!ensure.ok) return { ok: false, detail: `bucket: ${ensure.detail}`, at };
    const list = listBackups();
    const target = rawFile ? list.find((b) => b.file === rawFile) : list[0];
    if (!target) return { ok: false, detail: rawFile ? `arsip ${rawFile} tidak ada lokal` : "belum ada arsip lokal", at };
    const bytes = fs.readFileSync(path.join(BACKUP_DIR, target.file));
    const up = await storageUploadBackup(target.file, bytes);
    await emit({ type: EVENT_TYPES.BACKUP_CLOUD, subjectType: "KERNEL", subjectId: "backup-cloud", payload: { file: target.file, ok: up.ok, detail: up.detail } });
    return { ok: up.ok, detail: up.detail, file: target.file, at };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "cloud error", at };
  }
}

export async function cloudBackupList(): Promise<{ ok: boolean; items: Array<{ name: string; size: number; at: string }>; detail: string }> {
  const { storageListBackups } = await import("./supabase");
  return storageListBackups();
}

/** Unduh arsip dari awan (bila belum ada lokal) lalu restore. */
export async function restoreFromCloud(rawFile: string, scope: RestoreScope = "full"): Promise<RestoreResult> {
  const file = sanitizeBackupName(rawFile);
  const at = new Date().toISOString();
  const steps: string[] = [];
  if (!file) return { ok: false, file: rawFile, scope, detail: "nama arsip tidak sah", steps, at };
  if (!fs.existsSync(path.join(BACKUP_DIR, file))) {
    const { storageDownloadBackup } = await import("./supabase");
    const dl = await storageDownloadBackup(file);
    if (!dl.ok || !dl.bytes) return { ok: false, file, scope, detail: `unduh gagal: ${dl.detail}`, steps, at };
    fs.writeFileSync(path.join(BACKUP_DIR, file), dl.bytes);
    steps.push(`terunduh dari awan (${(dl.bytes.length / 1e6).toFixed(1)} MB)`);
  } else {
    steps.push("arsip sudah ada lokal — unduh dilewati");
  }
  const r = await restoreBackup(file, scope);
  return { ...r, steps: [...steps, ...r.steps] };
}

// ---------- SELF SYNC (git push ke 4 remote) ----------

function readTokens(): Record<string, string> {
  try {
    const out: Record<string, string> = {};
    for (const line of fs.readFileSync(GITCREDS, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m) out[m[1]] = m[2].trim();
    }
    return out;
  } catch {
    return {};
  }
}

export interface SyncResult {
  ok: boolean;
  committed: boolean;
  commit?: string;
  remotes: Array<{ name: string; pushed: boolean; detail: string }>;
  at: string;
}

export async function gitSync(): Promise<SyncResult> {
  const at = new Date().toISOString();
  const remotes: SyncResult["remotes"] = [];
  let commitBlocked = "";
  // 1) commit bila ada perubahan — dengan retry (race index.lock dengan daemon/UI)
  const st = await sh("git", ["status", "--porcelain"]);
  let committed = false;
  let commit = "";
  if (st.out.trim()) {
    for (let attempt = 0; attempt < 3 && !committed; attempt++) {
      const c = await sh("git", ["add", "-A"]);
      if (c.code !== 0) { commitBlocked = `add gagal: ${(c.err || c.out).slice(0, 120)}`; await new Promise((r) => setTimeout(r, 2500)); continue; }
      const cm = await sh("git", ["commit", "-m", `self-sync: ${new Date().toISOString()} — otomatis oleh CIVITAS daemon`]);
      if (cm.code === 0) {
        committed = true;
        const id = await sh("git", ["rev-parse", "--short", "HEAD"]);
        commit = id.out.trim();
      } else {
        commitBlocked = `commit gagal: ${(cm.err || cm.out).split("\n").filter(Boolean)[0]?.slice(0, 120) ?? "?"}`;
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  }
  // 2) push per remote dengan token transient (URL tidak disimpan)
  const tokens = readTokens();
  for (const r of REMOTES) {
    if (commitBlocked && st.out.trim() && !committed) { remotes.push({ name: r.name, pushed: false, detail: `dilewati — ${commitBlocked}` }); continue; }
    const tok = tokens[r.tokenKey];
    if (!tok) { remotes.push({ name: r.name, pushed: false, detail: "token tidak ada di .gitcreds — lewati (jujur)" }); continue; }
    const authed = r.ssh ? r.url : r.url.replace("https://", `https://oauth2:${tok}@`);
    // ssh.variant=openssh eksplisit — deteksi otomatis git bisa jatuh ke 'simple' yang menolak port
    const args = r.ssh ? ["-c", "ssh.variant=openssh", "push", authed, "main:main"] : ["push", authed, "main:main"];
    const p = await sh("git", args, 180_000, ROOT, r.ssh ? { GIT_SSH: "/home/z/.ssh-tools/sshx.ts" } : undefined);
    remotes.push({ name: r.name, pushed: p.code === 0, detail: p.code === 0 ? "pushed" : (p.err || p.out).split("\n").filter(Boolean).slice(-1)[0]?.slice(0, 160) ?? "gagal" });
  }
  const ok = remotes.some((r) => r.pushed) || (!st.out.trim()); // tanpa perubahan & tanpa push = sinkron
  if (ok) {
    await db.civKV.upsert({ where: { key: KV_LAST_SYNC }, create: { key: KV_LAST_SYNC, value: JSON.stringify({ at, commit }) }, update: { value: JSON.stringify({ at, commit }) } });
    await emit({ type: EVENT_TYPES.SYNC_PUSHED, subjectType: "KERNEL", subjectId: "git", payload: { commit, pushed: remotes.filter((r) => r.pushed).map((r) => r.name) } });
  }
  return { ok, committed, commit, remotes, at };
}

// ---------- DOCTOR ----------

export interface DoctorReport {
  healthy: boolean;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
  at: string;
}

export async function doctor(): Promise<DoctorReport> {
  const checks: DoctorReport["checks"] = [];
  const push = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });
  // 1 DB
  try {
    const n = await db.civOrg.count();
    push("database", true, `SQLite hidup · ${n} organ`);
  } catch (e) { push("database", false, e instanceof Error ? e.message : "db error"); }
  // 2 config
  const cfg = await db.civKV.findMany({ where: { key: { startsWith: "config." } } });
  push("config", true, `${cfg.length} field tersimpan (sisanya default/env)`);
  // 3 server Minecraft
  const { listServerStatuses } = await import("./servers");
  for (const s of await listServerStatuses()) {
    push(`server:${s.id}`, s.online, s.online ? `${s.edition} online ${s.latencyMs}ms` : `offline — ${s.error ?? "?"}`);
  }
  // 4 backup
  const backups = listBackups();
  push("backup", backups.length > 0, backups.length ? `${backups.length} arsip · terakhir ${backups[0].file}` : "belum ada arsip — jalankan backup");
  // 5 git
  const gs = await sh("git", ["status", "--porcelain"]);
  push("git-tree", gs.code === 0, gs.out.trim() ? `${gs.out.trim().split("\n").length} file berubah (belum sync)` : "bersih");
  const tokens = readTokens();
  push("git-creds", Object.keys(tokens).length >= 4, `${Object.keys(tokens).length}/4 token terbaca dari .gitcreds`);
  // 6 rahasia bocor di tree (bukan .git)
  const leak = await sh("rg", ["-l", "--no-ignore", "-g", "!.git", "-g", "!node_modules", "-g", "!.next", "sb_secret_[A-Za-z0-9]{10,}|github_pat_[A-Za-z0-9_]{20,}"], 30_000);
  push("secret-scan", leak.code !== 0 || !leak.out.trim(), leak.out.trim() ? `BOCOR: ${leak.out.trim().split("\n").slice(0, 3).join(", ")}` : "bersih");
  // 7 disk
  const df = await sh("df", ["-h", ROOT]);
  const diskLine = df.out.split("\n")[1];
  push("disk", true, diskLine ? diskLine.split(/\s+/).slice(-2).join(" / ") : "n/a");
  // 8 LLM — z-ai-web-dev-sdk membawa kredensialnya sendiri (sandbox), cek paketnya ada
  const llmKey = fs.existsSync(path.join(ROOT, "node_modules/z-ai-web-dev-sdk")) || cfg.some((c) => c.key === "config.llm.apiKey");
  push("llm-key", llmKey, llmKey ? "SDK z-ai tersedia (LLM hidup)" : "SDK tidak ada — reflex mode saja");
  const okAll = checks.every((c) => c.ok);
  return { healthy: okAll, checks, at: new Date().toISOString() };
}

// ---------- SELF LIFE TICK ----------

export interface SelfLifeResult {
  at: string;
  revived: Array<{ id: string; revived: boolean; detail: string }>;
  pulse?: { tick: number; target: string; summary: string };
  backupRan: boolean;
  backup?: BackupResult;
  syncRan: boolean;
  sync?: SyncResult;
  notes: string[];
}

/** Satu detak kehidupan — dipanggil daemon (30 dtk), cron, atau UI. Idempoten dan aman bersamaan. */
export async function selfLifeTick(): Promise<SelfLifeResult> {
  const notes: string[] = [];
  const out: SelfLifeResult = { at: new Date().toISOString(), revived: [], backupRan: false, syncRan: false, notes };
  // 1) watchdog server + cache status (dipakai state/UI agar tetap cepat)
  try {
    out.revived = await watchdogServers();
    if (out.revived.length) notes.push(`${out.revived.length} server dicoba hidupkan`);
    await writeServerStatusCache();
  }
  catch (e) { notes.push(`watchdog gagal: ${e instanceof Error ? e.message : "?"}`); }
  // 1b) KEHADIRAN JAVA (F-05 fix): bot CIVITAS_AGENT join Paper lokal bila belum
  // terhubung + perintah `list` sebagai bukti hidup di log Java. Non-fatal.
  try {
    const jb = await import("./javabot");
    const st = jb.javaBotStatus();
    if (!st.connected && !st.connecting) {
      const r = await jb.javaBotConnect();
      notes.push(r.ok ? `javabot: ${st.username} join Java realm` : `javabot gagal: ${r.error ?? r.detail}`);
    } else {
      await jb.javaBotCommand("list");
      notes.push(`javabot: ${st.username} hadir (list dikirim)`);
    }
  } catch (e) { notes.push(`javabot error: ${e instanceof Error ? e.message : "?"}`); }
  // 1c) LEADER WATCHDOG — RATU_CIVITAS, pemain pemimpin ekosistem di Aternos, harus hidup 24/7.
  // Proses mati / denyut tertinggal > 6 menit → hidupkan ulang (ter-guard lock 3 menit). Non-fatal.
  try {
    const leaderFile = path.join(ROOT, ".civitas/organism/leader.json");
    if (fs.existsSync(leaderFile)) {
      const leader = JSON.parse(fs.readFileSync(leaderFile, "utf8")) as { pid?: number; lastHeartbeat?: string; status?: string; name?: string };
      const hbAge = leader.lastHeartbeat ? Date.now() - new Date(leader.lastHeartbeat).getTime() : Infinity;
      let pidAlive = false;
      if (leader.pid) { try { process.kill(leader.pid, 0); pidAlive = true; } catch { /* proses mati */ } }
      if (!pidAlive || hbAge > 6 * 60_000) {
        const lock = path.join(ROOT, ".civitas/organism/leader.spawn.lock");
        let lockFresh = false;
        try { lockFresh = Date.now() - fs.statSync(lock).mtimeMs < 3 * 60_000; } catch { /* lock belum ada */ }
        if (!lockFresh) {
          fs.writeFileSync(lock, String(Date.now()));
          const child = spawn("bun", [path.join(ROOT, "scripts/leader_agent.mjs")], { detached: true, stdio: "ignore", cwd: ROOT });
          child.unref();
          notes.push(`leader: ${leader.name ?? "RATU_CIVITAS"} dihidupkan ulang (pid ${child.pid ?? "?"})`);
          await emit({ type: EVENT_TYPES.LEADER_RESPAWNED, subjectType: "KERNEL", subjectId: "leader", payload: { pid: child.pid, reason: !pidAlive ? "proses-mati" : "heartbeat-tertinggal" } });
        } else {
          notes.push("leader: mati namun lock spawn segar — tunggu siklus berikut");
        }
      } else {
        notes.push(`leader: ${leader.name ?? "RATU_CIVITAS"} hidup (pid ${leader.pid}, denyut ${Math.round(hbAge / 1000)}s lalu, status ${leader.status ?? "?"})`);
      }
    }
  } catch (e) { notes.push(`leader watchdog gagal: ${e instanceof Error ? e.message : "?"}`); }
  // 1d) SELF SERVER — web app produksi (port 3000) harus hidup 24/7: dashboard + endpoint
  // organisme + API kernel. Mati → spawn ulang detached (guard lock 2 menit). Non-fatal.
  try {
    const res = await fetch("http://127.0.0.1:3000/", { signal: AbortSignal.timeout(4000) }).catch(() => null);
    if (!res) {
      const lock = path.join(ROOT, ".civitas/selfserver.spawn.lock");
      let lockFresh = false;
      try { lockFresh = Date.now() - fs.statSync(lock).mtimeMs < 2 * 60_000; } catch { /* lock belum ada */ }
      if (!lockFresh) {
        fs.writeFileSync(lock, String(Date.now()));
        const child = spawn("bun", ["node_modules/next/dist/bin/next", "start", "-p", "3000"], { detached: true, stdio: "ignore", cwd: ROOT });
        child.unref();
        notes.push(`self-server: web app dihidupkan ulang (pid ${child.pid ?? "?"})`);
      } else {
        notes.push("self-server: mati, lock spawn segar — tunggu siklus berikut");
      }
    } else {
      notes.push(`self-server: hidup (HTTP ${res.status})`);
    }
  } catch (e) { notes.push(`self-server watchdog gagal: ${e instanceof Error ? e.message : "?"}`); }
  // 2) denyut peradaban (organ round-robin + desa)
  try {
    const tick = await heartbeatTick();
    out.pulse = { tick: tick.tick, target: tick.target, summary: tick.summary };
  } catch (e) { notes.push(`denyut gagal: ${e instanceof Error ? e.message : "?"}`); }
  // 2b) MC-NET-PROXY — jembatan WS->TCP untuk klien Minecraft web. Mati -> spawn detached.
  try {
    const res = await fetch("http://127.0.0.1:3010/healthz", { signal: AbortSignal.timeout(3000) }).catch(() => null);
    if (!res) {
      const lock = path.join(ROOT, ".civitas/mcnetproxy.spawn.lock");
      let lockFresh = false;
      try { lockFresh = Date.now() - fs.statSync(lock).mtimeMs < 2 * 60_000; } catch { /* lock belum ada */ }
      if (!lockFresh) {
        fs.writeFileSync(lock, String(Date.now()));
        const child = spawn("bun", [path.join(ROOT, "mini-services/mc-net-proxy/index.ts")], { detached: true, stdio: "ignore", cwd: ROOT });
        child.unref();
        notes.push(`mc-net-proxy: dihidupkan ulang (pid ${child.pid ?? "?"})`);
      } else {
        notes.push("mc-net-proxy: mati, lock spawn segar — tunggu siklus berikut");
      }
    } else {
      notes.push(`mc-net-proxy: hidup (HTTP ${res.status})`);
    }
  } catch (e) { notes.push(`mc-net-proxy watchdog gagal: ${e instanceof Error ? e.message : "?"}`); }
  // 2c) CACHE STATE — tulis snapshot state peradaban untuk jendela serverless (Vercel).
  // Di sandbox ini murah (SQLite lokal); di awan route /state menyajikannya instan.
  try {
    const { writeStateCache } = await import("./state");
    const wc = await writeStateCache();
    notes.push(`state cache: ${(wc.bytes / 1024).toFixed(0)} KB tertulis`);
    // dorong langsung ke awan agar jendela Vercel segar ≤ 30 dtk (non-fatal)
    try {
      const { readStateCache } = await import("./state");
      const { pushKVRow } = await import("./supabase");
      const fresh = await readStateCache();
      if (fresh) {
        const push = await pushKVRow("state.cache", JSON.stringify(fresh));
        if (!push.ok) notes.push(`state cache awan: ${push.detail}`);
      }
    } catch { /* non-fatal — siklus sync berikutnya tetap mencerminkan */ }
  } catch (e) { notes.push(`state cache gagal: ${e instanceof Error ? e.message : "?"}`); }
  // 3) backup sesuai jadwal
  const backupHours = Number((await getConfigValue("backup.intervalHours")) || "6");
  const lastB = await db.civKV.findUnique({ where: { key: KV_LAST_BACKUP } });
  const ageB = lastB ? Date.now() - new Date((JSON.parse(lastB.value) as { at: string }).at).getTime() : Infinity;
  if (ageB > backupHours * 3600_000) {
    out.backupRan = true;
    out.backup = await backupAll();
    if (!out.backup.ok) notes.push(`backup gagal: ${out.backup.detail}`);
    else {
      // v1.5 "CITADEL": auto sync arsip backup ke awan (Supabase Storage) — non-fatal
      try {
        const cloud = await backupToCloud(out.backup.file);
        notes.push(cloud.ok ? `backup-cloud: ${cloud.detail}` : `backup-cloud gagal: ${cloud.detail}`);
      } catch (e) { notes.push(`backup-cloud error: ${e instanceof Error ? e.message : "?"}`); }
    }
  }
  // 4) sync sesuai jadwal
  const syncMin = Number((await getConfigValue("sync.intervalMinutes")) || "30");
  const lastS = await db.civKV.findUnique({ where: { key: KV_LAST_SYNC } });
  const ageS = lastS ? Date.now() - new Date((JSON.parse(lastS.value) as { at: string }).at).getTime() : Infinity;
  if (ageS > syncMin * 60_000) {
    out.syncRan = true;
    out.sync = await gitSync();
    if (!out.sync.ok) notes.push(`sync: ${out.sync.remotes.filter((r) => !r.pushed).map((r) => r.name).join(",") || "semua"} gagal`);
    // v1.4 "SYNC": cerminan penuh seluruh DB kernel → Supabase (24 tabel, upsert idempoten)
    try {
      const { pushFullMirror } = await import("./supabase");
      const fm = await pushFullMirror();
      notes.push(fm.ok ? `supabase mirror: ${fm.rowsPushed} baris / ${fm.tables} tabel` : `supabase mirror gagal: ${fm.error ?? "?"}`);
    } catch (e) { notes.push(`supabase mirror error: ${e instanceof Error ? e.message : "?"}`); }
  }
  await db.civKV.upsert({
    where: { key: KV_LIFE },
    create: { key: KV_LIFE, value: JSON.stringify({ ...out, pulse: out.pulse ? `${out.pulse.target}: ${out.pulse.summary.slice(0, 80)}` : undefined, backup: out.backup?.file, sync: out.sync?.ok }) },
    update: { value: JSON.stringify({ ...out, pulse: out.pulse ? `${out.pulse.target}: ${out.pulse.summary.slice(0, 80)}` : undefined, backup: out.backup?.file, sync: out.sync?.ok }) },
  });
  return out;
}

export async function selfLifeStatus(): Promise<{ lastTick?: unknown; lastBackup?: unknown; lastSync?: unknown; backups: number }> {
  const [life, lb, ls] = await Promise.all([
    db.civKV.findUnique({ where: { key: KV_LIFE } }),
    db.civKV.findUnique({ where: { key: KV_LAST_BACKUP } }),
    db.civKV.findUnique({ where: { key: KV_LAST_SYNC } }),
  ]);
  return {
    lastTick: life ? JSON.parse(life.value) : undefined,
    lastBackup: lb ? JSON.parse(lb.value) : undefined,
    lastSync: ls ? JSON.parse(ls.value) : undefined,
    backups: listBackups().length,
  };
}
