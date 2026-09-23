// Uji RakNet ping ke server lokal — bukti protokol nyata (sama dengan kernel minecraft.ts)
import * as dgram from "node:dgram";

const host = process.argv[2] ?? "127.0.0.1";
const port = Number(process.argv[3] ?? 19132);
const MAGIC = Buffer.from("00ffff00fefefefefdfdfdfd12345678", "hex");

function readVarint(buf: Buffer, offset: number): { value: number; offset: number } {
  let num = 0, shift = 0, i = offset;
  while (true) {
    const b = buf[i];
    if (b === undefined) throw new Error("varint out of range");
    num |= (b & 0x7f) << shift;
    i += 1;
    if ((b & 0x80) === 0) break;
    shift += 7;
    if (shift > 28) throw new Error("varint terlalu panjang");
  }
  return { value: num >>> 0, offset: i };
}

export function pingBedrock(host: string, port: number, timeoutMs = 4000): Promise<{ online: boolean; latencyMs: number | null; version?: string; players?: number; motd?: string; error?: string }> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const sock = dgram.createSocket("udp4");
    const done = (st: { online: boolean; latencyMs: number | null; version?: string; players?: number; motd?: string; error?: string }) => {
      try { sock.close(); } catch { /* noop */ }
      resolve(st);
    };
    const timer = setTimeout(() => done({ online: false, latencyMs: null, error: "timeout" }), timeoutMs);
    sock.on("message", (msg) => {
      clearTimeout(timer);
      try {
        if (msg[0] !== 0x1c) return done({ online: false, latencyMs: null, error: `balasan 0x${msg[0].toString(16)}` });
        // len di 33, str di 35 (id1+time8+guid8+magic16)
        const strLen = msg.readUInt16BE(33);
        const str = msg.slice(35, 35 + strLen).toString("utf8");
        const f = str.split(";");
        done({ online: true, latencyMs: Date.now() - t0, motd: f[1], version: f[3], players: Number(f[4]) });
      } catch (e) {
        done({ online: false, latencyMs: null, error: e instanceof Error ? e.message : "?" });
      }
    });
    sock.on("error", (e) => { clearTimeout(timer); done({ online: false, latencyMs: null, error: e.message }); });
    const pkt = Buffer.concat([
      Buffer.from([0x01]),
      Buffer.alloc(8), // time di 1
      MAGIC, // magic di 9
      Buffer.alloc(8), // guid di 25
    ]);
    pkt.writeBigInt64BE(BigInt(Date.now()), 1);
    sock.send(pkt, port, host, (err) => { if (err) { clearTimeout(timer); done({ online: false, latencyMs: null, error: err.message }); } });
  });
}

const st = await pingBedrock(host, port, 5000);
console.log(JSON.stringify(st, null, 2));
