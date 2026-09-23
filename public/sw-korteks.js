/* sw-korteks.js — Endpoint nyata tanpa server (opsional).
   Mencegat fetch('/api/korteks/v1/*') di browser yang sama dan melayani
   langsung dari IndexedDB — semantik HTTP penuh, nol backend. */

const DB_NAME = "flybrain-os";
const STORES = ["identity", "memories", "logs", "decisions", "receipts", "gateway_log", "prt_events", "settings"];

self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function getAll(store) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const r = db.transaction(store, "readonly").objectStore(store).getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => reject(r.error);
      }),
  );
}
function putRec(store, rec) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, "readwrite");
        t.objectStore(store).put(rec);
        t.oncomplete = () => resolve(true);
        t.onerror = () => reject(t.error);
      }),
  );
}
function delRec(store, id) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, "readwrite");
        t.objectStore(store).delete(id);
        t.oncomplete = () => resolve(true);
        t.onerror = () => reject(t.error);
      }),
  );
}
async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 0xffff).toString(36).padStart(4, "0")}`;
}
function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

async function verifyAuth(req) {
  const auth = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(FK1_[0-9a-f]{64})$/i.exec(auth.trim());
  if (!m) return false;
  const idb = await getAll("identity");
  const idp = (idb[0] && idb[0].payload) || {};
  if (!idp.keyHash) return false;
  return (await sha256Hex("hash|" + m[1])) === idp.keyHash;
}

async function handle(method, path, req) {
  const sub = path.replace(/^\/api\/korteks/, "").replace(/\/+$/, "");
  let body = null;
  if (method === "POST" || method === "PUT") {
    try { body = await req.json(); } catch { body = {}; }
  }

  if (method === "GET" && sub === "/v1/connectome/summary") {
    return json(200, { ok: true, note: "Ringkasan publik — SW mode.", virtual: { neurons: 182 } });
  }
  const ok = await verifyAuth(req);
  if (!ok) return json(401, { ok: false, error: { code: "UNAUTHORIZED", message: "Bearer FK1_ tidak sah." } });

  if (sub === "/v1/identity/verify" && method === "POST") {
    const idb = await getAll("identity");
    const idp = (idb[0] && idb[0].payload) || {};
    return json(200, { ok: true, username: idp.username || null, tier: idp.tier || "FREE", tierUntil: idp.tierUntil || null });
  }
  if (sub === "/v1/memory" && method === "GET") {
    const items = await getAll("memories");
    return json(200, { ok: true, count: items.length, items: items.reverse() });
  }
  if (sub === "/v1/memory" && method === "POST") {
    const rec = { id: makeId("mem"), ts: new Date().toISOString(), source: "gateway", version: 1, payload: body || {} };
    await putRec("memories", rec);
    return json(201, { ok: true, id: rec.id, ts: rec.ts });
  }
  if (sub === "/v1/memory" && method === "DELETE") {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json(400, { ok: false, error: { code: "BAD_REQUEST", message: "id wajib." } });
    await delRec("memories", id);
    return json(200, { ok: true, deleted: id });
  }
  if (sub === "/v1/logs" && (method === "GET" || method === "POST")) {
    if (method === "GET") return json(200, { ok: true, items: (await getAll("logs")).reverse() });
    const rec = { id: makeId("log"), ts: new Date().toISOString(), source: "gateway", version: 1, payload: body || {} };
    await putRec("logs", rec);
    return json(201, { ok: true, id: rec.id });
  }
  if (sub === "/v1/decisions" && (method === "GET" || method === "POST")) {
    if (method === "GET") return json(200, { ok: true, items: (await getAll("decisions")).reverse() });
    const rec = { id: makeId("dec"), ts: new Date().toISOString(), source: "gateway", version: 1, payload: body || {} };
    await putRec("decisions", rec);
    return json(201, { ok: true, id: rec.id });
  }
  if (sub === "/v1/system/status" && method === "GET") {
    const out = {};
    for (const s of STORES) out[s] = (await getAll(s)).length;
    return json(200, { ok: true, mode: "service-worker", counts: out });
  }
  if (sub === "/v1/vault/export" && method === "GET") {
    const out = { schema: "flybrain.vault/v1", exportedAt: new Date().toISOString() };
    for (const s of STORES) out[s] = await getAll(s);
    return json(200, { ok: true, vault: out });
  }
  return json(404, { ok: false, error: { code: "NOT_FOUND", message: "Rute SW tidak dikenal: " + method + " " + sub } });
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/api/korteks/")) return;
  if (e.request.method !== "GET" && e.request.method !== "POST" && e.request.method !== "DELETE" && e.request.method !== "PUT") return;
  e.respondWith(handle(e.request.method, url.pathname + (url.search || ""), e.request).catch((err) => json(500, { ok: false, error: { code: "SW_ERROR", message: String(err) } })));
});

/* ------------------------------------------------------------------
   v1.2.2 — DENYUT 24/7 (tiga lapis, semua LOKAL — zero-storage tetap).
   SW TIDAK bisa menjalankan engine creature (itu hidup di halaman +
   IndexedDB user); yang SW lakukan: (a) menulis denyut infrastruktur
   ke ledger lokal agar jejak hidup tak bolong saat halaman tertutup,
   (b) membangunkan klien yang ada agar engine mengejar denyut penuh.
   periodicsync = Chrome + PWA terpasang [D]; sync = sekali event online.
   ------------------------------------------------------------------ */

async function swPulse(source) {
  try {
    await putRec("logs", {
      id: makeId("log"),
      ts: new Date().toISOString(),
      source: "korteks-sw",
      version: 1,
      payload: {
        channel: "biosfer.korteks",
        level: "info",
        message: `[SUCCESS:sw-pulse] denyut infrastruktur (${source}) — biosfer tercatat terus tanpa halaman, tanpa LLM, tanpa server.`,
      },
    });
  } catch (e) {
    /* ledger tertutup — denyut infrastruktur diam-diam lewati */
  }
  try {
    const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of cs) c.postMessage({ type: "korteks-pulse", source });
  } catch (e) {
    /* tidak ada klien — normal saat browser segar dibuka */
  }
}

self.addEventListener("periodicsync", (e) => {
  if (e.tag === "korteks-denyut") e.waitUntil(swPulse("periodicsync"));
});

self.addEventListener("sync", (e) => {
  if (e.tag === "korteks-sync") e.waitUntil(swPulse("sync"));
});

self.addEventListener("message", (e) => {
  if (e?.data?.type === "korteks-register-sync" && self.registration?.periodicSync) {
    e.waitUntil(
      self.registration.periodicSync
        .register("korteks-denyut", { minInterval: 12 * 60 * 60 * 1000 })
        .catch(() => {}),
    );
  }
});
