// Probe JS murni (node) — bot join PMMP lokal, tanpa dependensi kernel.
import { createClient, ping } from "bedrock-protocol";

const HOST = process.argv[2] ?? "127.0.0.1";
const PORT = Number(process.argv[3] ?? 19132);

const st = await ping({ host: HOST, port: PORT }).catch((e) => ({ error: e.message }));
console.log("[probe] ping:", JSON.stringify(st).slice(0, 220));

const client = createClient({ host: HOST, port: PORT, username: "CIVITAS_AGENT", offline: true, connectTimeout: 15000 });

let spawned = false;
const chat = [];
const villagers = [];

const finish = (why) => {
  console.log(`[probe] SELESAI (${why}) spawn=${spawned} chat=${chat.length} villager=${villagers.length}`);
  console.log("[probe] chat log:", JSON.stringify(chat.slice(0, 6)));
  try { client.disconnect(); } catch {}
  process.exit(0);
};

client.on("spawn", () => {
  spawned = true;
  console.log("[probe] SPAWN OK — bot di dalam dunia nyata");
  setTimeout(() => {
    client.write("text", { type: "chat", needs_translation: false, category: 1, source_name: "CIVITAS_AGENT", message: "Salam dari CIVITAS OS — peradaban masuk dunia.", xuid: "", platform_chat_id: "", filtered_message: "" });
    console.log("[probe] chat hadir dikirim");
  }, 2000);
});

client.on("packet", (des) => {
  const name = des?.data?.name ?? "";
  if (name === "text") {
    const p = des.data.params;
    const line = `${p.source_name ?? "?"}: ${p.message ?? ""}`;
    if (!chat.includes(line)) { chat.push(line); console.log("[chat]", String(line).slice(0, 140)); }
  }
  if (/^add_(entity_actor|actor|entity)$/.test(name)) {
    const p = des.data.params;
    const t = String(p.type ?? p.entity_type ?? "?");
    const uid = String(p.unique_id ?? p.unique_id_long ?? "?");
    if (/villager/i.test(t)) { villagers.push(uid); console.log("[entitas] villager", uid, t); }
  }
});

client.on("kick", (r) => { console.log("[probe] KICK:", JSON.stringify(r).slice(0, 200)); finish("kick"); });
client.on("error", (e) => { console.log("[probe] ERROR:", e.message.slice(0, 200)); finish("error"); });

setTimeout(() => finish("30s"), 30000);
