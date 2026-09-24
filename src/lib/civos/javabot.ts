// CIVITAS OS — javabot.ts (SLICE 16, Task 16-d)
// BOT MINECRAFT JAVA EDITION NYATA (mineflayer) — kembaran jalur mcbot.ts (Bedrock),
// untuk server Paper lokal 127.0.0.1:25565 (online-mode=false).
//   CONNECT    → login + spawn nyata via protokol Java (negosiasi versi otomatis);
//   CHAT       → pesan dunia nyata dari bot;
//   COMMAND    → tulis perintah ke FIFO stdin Paper (mc-server/java/console.in)
//                = konsol server berjalan sebagai console/OP (jalur kernel→Java-console);
//   STATUS     → keadaan runtime seadanya + ring buffer 50 event ber-timestamp;
//   RECONNECT  → backoff 2/4/8 dtk, maksimal 3 percobaan, hanya saat "end" tak terduga.
// REALITY WINS: tidak ada sukses palsu — kegagalan koneksi/chat/FIFO dikembalikan
// sebagai error jujur; semua fungsi menangkap kesalahan dan TIDAK PERNAH melempar.
// Catatan teknik: file ini hanya memakai sintaks TS "erasable" (tanpa enum/namespace/
// parameter-property, tanpa impor statis alias @/) agar dapat diimpor langsung oleh
// probe node (type-stripping bawaan node >= 22.6) DAN oleh kernel Next.js.

import { existsSync } from "node:fs";
import { open } from "node:fs/promises";
import { resolve } from "node:path";

// ---------- Konstanta publik ----------

export const JAVA_BOT_NAME = "CIVITAS_AGENT";
export const JAVA_SERVER_HOST = "127.0.0.1";
export const JAVA_SERVER_PORT = 25565;
export const RING_MAX = 50;
export const RECONNECT_MAX_TRIES = 3;
const RECONNECT_BASE_MS = 2_000;

/** FIFO stdin server Paper — perintah di sini dieksekusi konsol (OP penuh). */
export const JAVA_CONSOLE_FIFO =
  process.env.CIVITAS_JAVA_CONSOLE || resolve(process.cwd(), "mc-server", "java", "console.in");

/** Log server Paper — tempat bukti join/chat/output perintah dapat diverifikasi. */
export const JAVA_SERVER_LOG =
  process.env.CIVITAS_JAVA_LOG || resolve(process.cwd(), "mc-server", "java", "logs", "latest.log");

// ---------- Tipe publik ----------

export interface JavaBotEvent {
  at: string;
  type: string;
  detail: string;
}

export interface JavaBotStatus {
  configured: boolean; // FIFO konsol ditemukan → jalur kernel→konsol siap
  connected: boolean; // bot benar-benar spawn di dunia
  connecting: boolean;
  username: string;
  server: string;
  since: string | null; // sejak kapan spawn (ISO)
  fifo: string;
  log: string;
  reconnect: { tries: number; max: number; lastError: string | null };
  lastEvents: JavaBotEvent[];
}

export interface JavaBotResult {
  ok: boolean;
  detail: string;
  at: string;
  error?: string;
  command?: string;
}

export interface JavaBotConnectOpts {
  username?: string;
  host?: string;
  port?: number;
  timeoutMs?: number;
}

// ---------- Tipe mineflayer minimal (impor dinamis anti-bundler, pola mcbot.ts) ----------

interface MineflayerBot {
  username: string;
  entity?: unknown;
  chat: (message: string) => void;
  quit: () => void;
  end: () => void;
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
}

// ---------- State runtime (singleton per proses) ----------

type BotState = "disconnected" | "connecting" | "connected";
let state: BotState = "disconnected";
let bot: MineflayerBot | null = null;
let botUsername = JAVA_BOT_NAME;
let botHost = JAVA_SERVER_HOST;
let botPort = JAVA_SERVER_PORT;
let connectedSince: string | null = null;
let quitIntentional = false;
let reconnectTries = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let lastError: string | null = null;
const ring: JavaBotEvent[] = [];
let kernelBusWarned = false;

// ---------- Util ----------

function logEvent(type: string, detail: string): void {
  ring.push({ at: new Date().toISOString(), type, detail: String(detail).slice(0, 300) });
  if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
}

/** Event penting juga masuk event bus kernel (MC_STATUS) bila modul events dapat dijangkau.
 *  Di luar kernel (probe node) impor "./events" gagal — dicatat sekali, TIDAK fatal, jujur. */
async function emitKernel(payload: Record<string, unknown>): Promise<void> {
  try {
    const eventsMod = (await import("./events")) as {
      emit: (a: { type: string; subjectType: string; subjectId: string; payload?: Record<string, unknown> }) => Promise<number>;
    };
    await eventsMod.emit({ type: "MC_STATUS", subjectType: "MINECRAFT_JAVA", subjectId: `${botHost}:${botPort}`, payload });
  } catch (e) {
    if (!kernelBusWarned) {
      kernelBusWarned = true;
      logEvent(
        "kernel_bus_unavailable",
        `event bus kernel tak terjangkau dari runtime ini (${e instanceof Error ? e.message.slice(0, 120) : "?"}) — event tetap terekam di ring buffer`,
      );
    }
  }
}

function botPosition(b: MineflayerBot): string {
  try {
    const e = b.entity as { position?: { x: number; y: number; z: number } } | undefined;
    if (e && e.position) return `${Math.round(e.position.x)} ${Math.round(e.position.y)} ${Math.round(e.position.z)}`;
  } catch {
    /* entity belum siap */
  }
  return "?";
}

/** Tulis data ke FIFO stdin Paper. open("w") pada FIFO MENUNGGU pembaca (java < console.in);
 *  bila server mati open bisa menggantung → dibungkus timeout. appendFile murni tidak bisa
 *  dibatalkan, maka dipakai open/write/close dari fs/promises (keluarga API yang sama). */
async function writeFifo(data: string, timeoutMs: number): Promise<string> {
  const openPromise = open(JAVA_CONSOLE_FIFO, "w");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const guard = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timeout ${timeoutMs}ms — tidak ada pembaca FIFO (server Paper mati?)`)), timeoutMs);
    });
    const handle = await Promise.race([openPromise, guard]);
    clearTimeout(timer);
    await handle.write(data);
    await handle.close();
    return `${Buffer.byteLength(data)} byte → ${JAVA_CONSOLE_FIFO}`;
  } catch (e) {
    if (timer) clearTimeout(timer);
    // Bila open akhirnya berhasil setelah timeout, tutup handle agar fd tidak bocor.
    openPromise
      .then((h) => h.close())
      .catch(() => {
        /* pembaca tak pernah datang — tak ada fd yang tercipta */
      });
    throw e;
  }
}

function scheduleReconnect(reason: string): void {
  if (quitIntentional) return;
  if (reconnectTimer) return; // sudah ada jadwal
  if (reconnectTries >= RECONNECT_MAX_TRIES) {
    logEvent("reconnect_give_up", `${RECONNECT_MAX_TRIES} percobaan ulang habis — biarkan putus (panggil javaBotConnect() manual)`);
    return;
  }
  const delay = RECONNECT_BASE_MS * 2 ** reconnectTries; // 2 dtk → 4 dtk → 8 dtk
  reconnectTries += 1;
  logEvent("reconnect_scheduled", `percobaan ${reconnectTries}/${RECONNECT_MAX_TRIES} dalam ${delay}ms (${reason})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void javaBotConnect().then((r) => {
      if (!r.ok) logEvent("reconnect_failed", r.detail);
    });
  }, delay);
}

// ---------- API publik ----------

/** Sambungkan bot ke dunia Java. Aman dipanggil berulang; tidak pernah melempar. */
export async function javaBotConnect(opts: JavaBotConnectOpts = {}): Promise<JavaBotResult> {
  const at = new Date().toISOString();
  if (state === "connected") {
    return { ok: true, detail: `sudah terhubung sebagai ${botUsername} sejak ${connectedSince}`, at };
  }
  if (state === "connecting") {
    return { ok: false, detail: "koneksi sedang berjalan — coba lagi nanti", at, error: "BUSY" };
  }

  botUsername = (opts.username ?? JAVA_BOT_NAME).slice(0, 16);
  botHost = opts.host ?? JAVA_SERVER_HOST;
  botPort = opts.port ?? JAVA_SERVER_PORT;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null; // niat manual mengalahkan jadwal reconnect
  }
  quitIntentional = false;
  state = "connecting";
  logEvent("connect_start", `${botUsername} → ${botHost}:${botPort} (offline, timeout ${timeoutMs}ms)`);

  try {
    // Impor runtime-only: bundler Next.js tidak boleh menggigit mineflayer (pola mcbot.ts).
    const importMineflayer = new Function("return import('mineflayer')") as () => Promise<{
      createBot?: unknown;
      default?: { createBot?: unknown };
    }>;
    const mod = await importMineflayer();
    const createBot = (mod.createBot ?? mod.default?.createBot) as ((o: Record<string, unknown>) => unknown) | undefined;
    if (typeof createBot !== "function") throw new Error("mineflayer.createBot tidak ditemukan — instalasi rusak?");

    const b = createBot({
      host: botHost,
      port: botPort,
      username: botUsername,
      auth: "offline",
      hideErrors: true, // error dicatat sendiri via event — library tidak menulis liar ke stdout
    }) as MineflayerBot;
    bot = b;

    const spawned = await new Promise<boolean>((resolveSpawn) => {
      let done = false;
      let waitTimer: ReturnType<typeof setTimeout> | undefined;
      const settle = (v: boolean) => {
        if (done) return;
        done = true;
        if (waitTimer) clearTimeout(waitTimer);
        resolveSpawn(v);
      };

      waitTimer = setTimeout(() => {
        lastError = `tidak spawn dalam ${timeoutMs}ms`;
        logEvent("connect_timeout", lastError);
        try {
          b.quit();
        } catch {
          /* soket mungkin belum ada */
        }
        settle(false);
      }, timeoutMs);

      b.on("login", (...args: unknown[]) => {
        logEvent("login", `login diterima server (uuid=${String(args[0] ?? "?").slice(0, 40)})`);
      });

      b.on("spawn", () => {
        state = "connected";
        connectedSince = new Date().toISOString();
        reconnectTries = 0;
        logEvent("spawn", `bot hadir di dunia Java (posisi ${botPosition(b)})`);
        void emitKernel({ online: true, bot: botUsername, edition: "JAVA", server: `${botHost}:${botPort}`, at: connectedSince });
        settle(true);
      });

      b.on("chat", (...args: unknown[]) => {
        logEvent("chat", `${String(args[0] ?? "?")}: ${String(args[1] ?? "")}`);
      });

      // mineflayer menamai event tendangan "kicked" (Bedrock: "kick").
      b.on("kicked", (...args: unknown[]) => {
        const reason = typeof args[0] === "string" ? args[0] : JSON.stringify(args[0] ?? {});
        lastError = `kicked: ${reason.slice(0, 140)}`;
        logEvent("kicked", reason.slice(0, 200));
      });

      b.on("end", () => {
        state = "disconnected";
        logEvent("end", quitIntentional ? "keluar dengan sengaja" : "koneksi berakhir tak terduga");
        if (!quitIntentional) {
          void emitKernel({ online: false, bot: botUsername, edition: "JAVA", reason: "end tak terduga" });
          scheduleReconnect("end tak terduga");
        }
        settle(false);
      });

      b.on("error", (...args: unknown[]) => {
        const m = args[0] instanceof Error ? args[0].message : String(args[0] ?? "error tak diketahui");
        lastError = m;
        logEvent("error", m.slice(0, 200));
        settle(false); // "end" biasanya menyusul — yang menjadwalkan reconnect
      });
    });

    if (!spawned) {
      try {
        b.quit();
      } catch {
        /* soket mungkin sudah mati */
      }
      bot = null;
      state = "disconnected";
      return { ok: false, detail: `gagal masuk dunia Java: ${lastError ?? "tidak diketahui"}`, at, error: lastError ?? undefined };
    }
    return { ok: true, detail: `terhubung — spawn sebagai ${botUsername} di ${botHost}:${botPort} pada ${connectedSince}`, at };
  } catch (e) {
    state = "disconnected";
    bot = null;
    const m = e instanceof Error ? e.message : String(e);
    lastError = m;
    logEvent("connect_error", m.slice(0, 200));
    return { ok: false, detail: `kesalahan konektor Java: ${m}`, at, error: m };
  }
}

/** Kirim chat dunia nyata dari bot. Tidak pernah melempar.
 *  Fallback jujur: bila state bot proses ini belum "connected" (Next dev bisa
 *  multi-worker), chat diteruskan via FIFO konsol `say` — tetap pesan dunia
 *  NYATA dari server, bukan simulasi. */
export async function javaBotChat(message: string): Promise<JavaBotResult> {
  const at = new Date().toISOString();
  const msg = String(message).replace(/\s+/g, " ").trim().slice(0, 256);
  if (!msg) {
    return { ok: false, detail: "pesan kosong", at, error: "EMPTY" };
  }
  if (state !== "connected" || !bot) {
    const viaConsole = await javaBotCommand(`say ${msg}`);
    if (viaConsole.ok) {
      return { ok: true, detail: `chat terkirim via konsol (say): "${msg}"`, at };
    }
    return { ok: false, detail: "bot TIDAK terhubung dan FIFO konsol tak tersedia — chat tidak terkirim", at, error: "NOT_CONNECTED" };
  }
  try {
    bot.chat(msg);
    logEvent("chat_sent", msg);
    return { ok: true, detail: `chat terkirim dari ${botUsername}: "${msg}"`, at };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    logEvent("chat_fail", m.slice(0, 200));
    return { ok: false, detail: `gagal mengirim chat: ${m}`, at, error: m };
  }
}

/** Tulis perintah nyata ke konsol Paper via FIFO stdin (berjalan sebagai console/OP).
 *  Tidak butuh bot terhubung — jalur kernel→konsol berdiri sendiri. Tidak pernah melempar. */
export async function javaBotCommand(cmd: string): Promise<JavaBotResult> {
  const at = new Date().toISOString();
  const command = String(cmd).replace(/^\//, "").trim();
  if (!command) {
    return { ok: false, detail: "perintah kosong", at, error: "EMPTY" };
  }
  if (!existsSync(JAVA_CONSOLE_FIFO)) {
    return { ok: false, detail: `FIFO konsol tidak ada di ${JAVA_CONSOLE_FIFO} — server Paper tidak berjalan?`, at, error: "NO_FIFO", command };
  }
  try {
    const wrote = await writeFifo(`${command}\n`, 5_000);
    logEvent("console_command", command);
    return {
      ok: true,
      detail: `perintah "${command}" ditulis ke konsol Paper (${wrote}) — output nyata menyusul di ${JAVA_SERVER_LOG}`,
      command,
      at,
    };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    logEvent("console_command_fail", `${command} — ${m}`);
    return { ok: false, detail: `gagal menulis ke FIFO konsol: ${m}`, at, error: m, command };
  }
}

/** Putuskan bot dengan bersih (quit). Tidak pernah melempar. */
export async function javaBotDisconnect(): Promise<JavaBotResult> {
  const at = new Date().toISOString();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    logEvent("reconnect_cancelled", "dibatalkan manual oleh javaBotDisconnect()");
  }
  quitIntentional = true;
  if (state === "connecting") {
    return { ok: false, detail: "masih menyambung — tunggu koneksi selesai lalu putus ulang", at, error: "BUSY" };
  }
  if (!bot || state !== "connected") {
    state = "disconnected";
    return { ok: true, detail: "tidak ada koneksi aktif (sudah putus)", at };
  }
  try {
    bot.quit();
    logEvent("quit", `quit dikirim untuk ${botUsername}`);
    return { ok: true, detail: "quit dikirim — event end akan mengonfirmasi", at };
  } catch {
    try {
      bot.end();
      return { ok: true, detail: "quit gagal — soket dipaksa end()", at };
    } catch (e2) {
      const m = e2 instanceof Error ? e2.message : String(e2);
      return { ok: false, detail: `gagal memutus koneksi: ${m}`, at, error: m };
    }
  }
}

/** Status jujur saat ini (tanpa efek samping). */
export function javaBotStatus(): JavaBotStatus {
  return {
    configured: existsSync(JAVA_CONSOLE_FIFO),
    connected: state === "connected",
    connecting: state === "connecting",
    username: botUsername,
    server: `${botHost}:${botPort}`,
    since: connectedSince,
    fifo: JAVA_CONSOLE_FIFO,
    log: JAVA_SERVER_LOG,
    reconnect: { tries: reconnectTries, max: RECONNECT_MAX_TRIES, lastError },
    lastEvents: [...ring],
  };
}
