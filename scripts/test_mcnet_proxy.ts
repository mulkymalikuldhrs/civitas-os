// Uji tunel mc-net-proxy end-to-end: legacy ping Java lewat WS bridge.
const PORT = 3010;

async function main() {
  const c = await fetch(`http://127.0.0.1:${PORT}/api/vm/net/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host: "127.0.0.1", port: 25565 }),
  });
  const j = await c.json();
  if (!j.token) { console.error("CONNECT GAGAL:", j); process.exit(1); }
  console.log("token ok, remote:", JSON.stringify(j.remote));

  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/api/vm/net/socket?token=${j.token}`);
  ws.binaryType = "arraybuffer";
  const done = (ok: boolean, note: string) => {
    console.log(ok ? "TUNEL_OK:" + note : "TUNEL_GAGAL:" + note);
    try { ws.close(); } catch { /* ok */ }
    process.exit(ok ? 0 : 1);
  };
  const timer = setTimeout(() => done(false, "timeout 5s tanpa balasan"), 5000);
  ws.onopen = () => {
    // legacy Server List Ping: 0xFE 0x01 0xFA
    ws.send(new Uint8Array([0xfe, 0x01, 0xfa]));
    console.log("legacy ping terkirim via WS");
  };
  ws.onmessage = (ev) => {
    const buf = new Uint8Array(ev.data as ArrayBuffer);
    clearTimeout(timer);
    done(buf[0] === 0xff, `balasan 0x${buf[0]?.toString(16)} (${buf.length} byte)`);
  };
  ws.onerror = () => { clearTimeout(timer); done(false, "ws error"); };
}
main();
