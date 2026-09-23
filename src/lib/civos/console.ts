// CIVITAS OS — console.ts (SLICE 10)
// Jembatan konsol server Minecraft LOKAL (PMMP) lewat FIFO stdin + log.
// Setiap perintah diaudit di CivConsoleLog — jujur penuh (sukses maupun gagal).
// Untuk server remote (Aternos) jalur ini TIDAK tersedia dan dilaporkan apa adanya.

import { promises as fs } from "node:fs";
import { db } from "@/lib/db";
import { getConfigValue } from "./config";

/** Kirim perintah ke konsol server lokal. Baca jawaban dari server.log (jendela pendek). */
export async function localConsoleCommand(command: string, source = "UI"): Promise<{ ok: boolean; response: string }> {
  const fifoPath = await getConfigValue("mc.localConsolePath");
  const logPath = await getConfigValue("mc.localLogPath");
  if (!fifoPath) return { ok: false, response: "jalur konsol lokal tidak dikonfigurasi" };

  const sizeBefore = await logTailSize(logPath);
  try {
    await fs.writeFile(fifoPath, command + "\n");
  } catch (e) {
    const err = e instanceof Error ? e.message.slice(0, 140) : "fifo gagal";
    await db.civConsoleLog.create({ data: { command, response: err, ok: false, source } });
    return { ok: false, response: err };
  }

  // Tunggu jawaban muncul di log (perintah PMMP menjawab via "Command output |")
  let response = "";
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 400));
    const tail = await readTailFrom(logPath, sizeBefore);
    if (tail.length > 0) {
      response = tail;
      break;
    }
  }
  const ok = !/unknown command|not found|GAGAL/i.test(response) && response.length > 0;
  await db.civConsoleLog.create({ data: { command, response: response.slice(0, 400) || "(tanpa jawaban dalam 4s)", ok, source } });
  return { ok, response: response.slice(0, 400) || "(tanpa jawaban dalam 4s)" };
}

async function logTailSize(logPath: string): Promise<number> {
  try {
    return (await fs.stat(logPath)).size;
  } catch {
    return 0;
  }
}

async function readTailFrom(logPath: string, from: number): Promise<string> {
  try {
    const stat = await fs.stat(logPath);
    if (stat.size <= from) return "";
    const fh = await fs.open(logPath, "r");
    const buf = Buffer.alloc(Math.min(stat.size - from, 8192));
    await fh.read(buf, 0, buf.length, from);
    await fh.close();
    return buf
      .toString("utf8")
      .split("\n")
      .filter((l) => /\[CIVITAS\]|Command output/.test(l))
      .map((l) => l.replace(/^.*?Command output \| /, "").replace(/\[\d\d:\d\d:\d\d[^\]]*\]/g, "").trim())
      .filter((l) => l.length > 0)
      .join("\n")
      .slice(0, 400);
  } catch {
    return "";
  }
}

/** Riwayat konsol untuk UI. */
export async function consoleLog(limit = 20) {
  const rows = await db.civConsoleLog.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(limit, 60) });
  return rows.map((r) => ({ id: r.id, command: r.command, response: r.response, ok: r.ok, source: r.source, at: r.createdAt.toISOString() }));
}
