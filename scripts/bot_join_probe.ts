// Probe: bot CIVITAS-AGENT join server lokal PMMP via bedrock-protocol (nyata).
// Bukti yang dicari: spawn → kirim chat → terima chat → daftar entitas villager.
import { db } from "../src/lib/db";
import { cachedStatus } from "../src/lib/civos/minecraft";

const HOST = process.argv[2] ?? "127.0.0.1";
const PORT = Number(process.argv[3] ?? 19132);

const importBedrock = new Function("return import('bedrock-protocol')") as () => Promise<typeof import("bedrock-protocol")>;
const bedrock = await importBedrock();

console.log("[probe] ping pra-join:", JSON.stringify(await cachedStatus(true)).slice(0, 200));

const client = bedrock.createClient({
  host: HOST,
  port: PORT,
  username: "CIVITAS-AGENT",
  offline: true,
  connectTimeout: 15_000,
});

let spawned = false;
const chatLog: string[] = [];
const entities: { uid: string; type: string; name?: string }[] = [];

const timer = setTimeout(() => {
  console.log("[probe] timeout 45s — spawn:", spawned, "| chat:", chatLog.length, "| entitas:", entities.length);
  try { client.disconnect(); } catch { /* noop */ }
  process.exit(0);
}, 45_000);

client.on("spawn", () => {
  spawned = true;
  console.log("[probe] SPAWN OK — bot ada di dalam dunia nyata");
  setTimeout(() => {
    client.write("text", { type: "chat", needs_translation: false, source_name: "CIVITAS-AGENT", message: "Salam dari CIVITAS OS — peradaban masuk dunia.", xuid: "", platform_chat_id: "", filtered_message: "" });
    console.log("[probe] chat hadir dikirim");
  }, 2_000);
});

client.on("packet", (des: { data?: { name?: string; params?: Record<string, unknown> } }) => {
  const name = des?.data?.name ?? "";
  if (name === "text") {
    const p = des.data!.params as { source_name?: string; message?: string };
    const line = `${p.source_name ?? "?"}: ${p.message ?? ""}`;
    if (!chatLog.includes(line)) { chatLog.push(line); console.log("[chat]", line.slice(0, 140)); }
  }
  if (/^add_(entity_actor|actor|entity)$/.test(name)) {
    const p = des.data!.params as Record<string, unknown>;
    const entityType = String((p as { type?: unknown }).type ?? (p as { entity_type?: unknown }).entity_type ?? "?");
    const uid = String((p as { unique_id?: unknown }).unique_id ?? (p as { unique_id_long?: unknown }).unique_id_long ?? "?");
    if (/villager/i.test(entityType)) {
      entities.push({ uid, type: entityType });
      console.log("[entitas] villager uid=", uid, "type=", entityType);
    }
  }
});

client.on("kick", (r: unknown) => { console.log("[probe] KICK:", JSON.stringify(r).slice(0, 200)); clearTimeout(timer); process.exit(0); });
client.on("error", (e: Error) => { console.log("[probe] ERROR:", e.message.slice(0, 200)); clearTimeout(timer); process.exit(0); });

setTimeout(async () => {
  console.log("[probe] RINGKASAN: spawn=", spawned, "chatDiterima=", chatLog.length, "villager=", entities.length);
  try { client.disconnect(); } catch { /* noop */ }
  clearTimeout(timer);
  process.exit(0);
}, 30_000);
