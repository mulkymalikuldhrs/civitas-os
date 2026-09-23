// FLYBRAIN OS — /api/mcp — ENDPOINT UNIVERSAL (STATELESS, ZERO-STORAGE)
// JSON-RPC 2.0 over HTTP: initialize · tools/list · tools/call — 9 tools (v1.2).
// Server AMNESIA: tidak ada DB, tidak ada sesi, tidak ada file yang ditulis.
// Kontrak auth: Bearer FK1_ + 64 hex (server hanya bisa memeriksa FORMAT —
// verifikasi penuh tetap di perangkat pemilik; diakui jujur di respons).
// v1.1: tools creature.list & creature.dispatch (BIOSFER) — katalog statis +
// dispatch stateless state creature dari klien → keputusan LLM.
// v1.2: tool world.map — dokumentasi hidup PLANET (wire table + rumus iklim +
// cara baca peta) — stateless murni, server tidak punya state dunia apa pun.

import { NextResponse } from "next/server";
import { buildAtlas, MACRO_FACTS } from "@/lib/flybrain/connectome";
import { validateReceipt } from "@/lib/flybrain/payment";
import { buildGenome, think, thinkChat } from "@/lib/flybrain/organism/brain";
import { CREATURES, creatureMeta, roleOrgan } from "@/lib/flybrain/organism/creatures";
import { maskKey } from "@/lib/flybrain/auth";
import { vetoDecision } from "@/lib/flybrain/organism/constitution";
import { WIRE_TABLE } from "@/lib/flybrain/ecosystem/world";
import { allowLlmCall, llmClientKey, LLM_BUDGET_LABEL } from "@/lib/flybrain/llm-budget";
import { MCP_TOOLS } from "@/lib/flybrain/mcp-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_INFO = { name: "flybrain-mcp", version: "1.0.0" };
const SUPPORTED_VERSIONS = ["2025-06-18", "2024-11-05"];

// ---------- JSON-RPC helpers ----------

interface RpcRequest {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

const rpcOk = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const rpcErr = (id: unknown, error: RpcError) => ({ jsonrpc: "2.0", id: id ?? null, error });

// ---------- Auth (format-only — jujur) ----------

const BEARER_RE = /^FK1_[0-9a-f]{64}$/;

function readBearer(req: Request): { present: boolean; validFormat: boolean; raw: string | null } {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  const raw = m ? m[1].trim() : null;
  return { present: Boolean(raw), validFormat: Boolean(raw && BEARER_RE.test(raw)), raw };
}

// ---------- Dispatch tools/call ----------

async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  bearer: { present: boolean; validFormat: boolean; raw: string | null },
  llmKey: string,
): Promise<{ result?: unknown; error?: RpcError }> {
  const authFail = (): RpcError => ({
    code: -32001,
    message: "kunci API tidak valid — sertakan header Authorization: Bearer FK1_<64 hex>",
  });
  // Guard budget LLM (audit F-08): tool penalar panggil LLM server — in-memory,
  // per bearer/IP; melebihi budget → error -32001 dengan pesan jujur.
  const budgetFail = (): RpcError => ({
    code: -32001,
    message: `budget instance tercapai — coba lagi nanti (${LLM_BUDGET_LABEL}). Stateless tetap amnesia.`,
  });

  switch (name) {
    case "system.status": {
      const atlas = buildAtlas();
      return {
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: true,
                  server: SERVER_INFO,
                  protocol: "JSON-RPC 2.0 (MCP stateless)",
                  stateless: true,
                  zeroStorage: true,
                  storageBackends: "tidak ada — tidak ada DB/file/kuota di server",
                  time: new Date().toISOString(),
                  uptimeSec: Math.round(process.uptime()),
                  atlas: { virtualNeurons: atlas.neurons.length, virtualEdges: atlas.edges.length, regions: atlas.regions.length },
                  macro: { female: MACRO_FACTS.female.neurons, male: MACRO_FACTS.male.neurons, attribution: "FlyWire / Janelia — CC BY-NC 4.0" },
                  bearer: {
                    present: bearer.present,
                    formatValid: bearer.validFormat,
                    masked: bearer.present && bearer.raw ? maskKey(bearer.raw) : null,
                    note: bearer.present && bearer.validFormat
                      ? "format sah; kunci digema TERSENSOR (8 hex pertama + 6 terakhir) agar pemilik bisa memverifikasi kunci mana yang sampai — server tetap amnesia dan tidak menyimpannya"
                      : "tidak ada / format salah",
                  },
                },
                null,
                2,
              ),
            },
          ],
        },
      };
    }

    case "prt.chat": {
      const message = typeof args.message === "string" ? args.message.trim() : "";
      if (!message) {
        return { error: { code: -32602, message: "invalid params — 'message' (string) wajib ada" } };
      }
      if (!allowLlmCall(llmKey)) return { error: budgetFail() };
      const r = await thinkChat(message, args.context ?? null);
      if (!r.reply) {
        return {
          result: {
            content: [
              {
                type: "text",
                text: "prt bermata tertutup: LLM tidak tersedia saat ini (kuota/jaringan). Mode refleks L1 tetap berjalan di perangkat pemilik. Coba lagi nanti.",
              },
            ],
            isError: true,
          },
        };
      }
      return {
        result: {
          content: [{ type: "text", text: r.reply }],
          meta: { model: r.model, latencyMs: r.latencyMs, stateless: true, zeroStorage: true },
        },
      };
    }

    case "connectome.query": {
      const atlas = buildAtlas();
      const region = typeof args.region === "string" ? args.region.toLowerCase() : null;
      const q = typeof args.q === "string" ? args.q.toLowerCase() : null;
      const limit = Math.min(50, Math.max(1, typeof args.limit === "number" ? Math.round(args.limit) : 12));
      let neurons = atlas.neurons;
      if (region) {
        if (!atlas.regions.some((r) => r.key === region)) {
          return {
            error: {
              code: -32602,
              message: `invalid params — region '${region}' tidak dikenal; pilihan: ${atlas.regions.map((r) => r.key).join(", ")}`,
            },
          };
        }
        neurons = neurons.filter((n) => n.region === region);
      }
      if (q) neurons = neurons.filter((n) => n.catalog.toLowerCase().includes(q));
      const payload = {
        ok: true,
        label: {
          atlas: "atlas virtual deterministik (±182 neuron, seeded) — model edukatif",
          macro: "statistik makro NYATA dengan atribusi (FlyWire / Janelia, CC BY-NC 4.0)",
        },
        regions: atlas.regions.map((r) => ({ key: r.key, name: r.name, module: r.module, role: r.role, share: r.share })),
        matched: neurons.length,
        neurons: neurons.slice(0, limit).map((n) => ({ catalog: n.catalog, region: n.region, degree: n.degree, synapses: n.synapses })),
        macro: MACRO_FACTS,
      };
      return { result: { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] } };
    }

    case "receipt.verify": {
      if (!bearer.validFormat) return { error: authFail() };
      const payer = typeof args.payer === "string" ? args.payer.trim() : "";
      if (!payer) {
        return { error: { code: -32602, message: "invalid params — 'payer' (username pemilik) wajib ada; server amnesia tidak bisa menebaknya" } };
      }
      if (!("receipt" in args) || args.receipt == null) {
        return { error: { code: -32602, message: "invalid params — 'receipt' wajib ada" } };
      }
      const verdict = await validateReceipt(args.receipt, payer);
      return {
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: verdict.valid,
                  reason: verdict.reason,
                  tier: verdict.tier,
                  until: verdict.until,
                  note: "validasi kanonik (checksum+masa aktif) dijalankan TANPA menyimpan kwitansi; kwitansi asli tetap disimpan pemilik di vault lokal",
                },
                null,
                2,
              ),
            },
          ],
        },
      };
    }

    case "memory.write":
    case "memory.recall": {
      return {
        error: {
          code: -32601,
          message: `tool '${name}' berjalan di sisi pemilik data (Service Worker klien / gerbang lokal sw-korteks); server tidak menyimpan apa pun — arahkan klien ke endpoint lokal /api/korteks/v1/memory (mode SW) atau konsep yang sama di perangkat pemilik`,
        },
      };
    }

    case "creature.list": {
      const payload = {
        ok: true,
        label: "katalog statis 6 creature BIOSFER (v1.1) — state kehidupan ada di klien pemilik",
        creatures: CREATURES.map((c) => ({
          id: c.id,
          name: c.name,
          species: c.species,
          role: c.role,
          organ: roleOrgan(c.role),
          description: c.description,
          reflex: c.reflex,
          llm: c.llm,
          color: c.color,
          icon: c.icon,
          traits: c.traits,
        })),
      };
      return { result: { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] } };
    }

    case "creature.dispatch": {
      const raw = (args.creature ?? {}) as Record<string, unknown>;
      const cid = typeof raw.id === "string" ? raw.id : "";
      if (!CREATURES.some((c) => c.id === cid)) {
        return {
          error: {
            code: -32602,
            message: `invalid params — creature.id tidak dikenal; katalog: ${CREATURES.map((c) => c.id).join(", ")}`,
          },
        };
      }
      const meta = creatureMeta(cid);
      const organ = roleOrgan(meta.role);
      const energy = typeof raw.energy === "number" ? Math.max(0, Math.min(100, raw.energy)) : 70;
      const wealth = typeof raw.wealth === "number" && raw.wealth >= 0 ? raw.wealth : 10;
      const skills = Array.isArray(raw.skills) ? raw.skills.filter((s) => typeof s === "string").slice(0, 12) : [];
      const pulseCount = typeof raw.pulseCount === "number" ? Math.max(0, Math.round(raw.pulseCount)) : 0;
      const status = typeof raw.status === "string" ? raw.status.slice(0, 12) : "aktif";
      const lastTrace = typeof raw.lastTrace === "string" ? raw.lastTrace.slice(0, 300) : null;
      if (!allowLlmCall(llmKey)) return { error: budgetFail() };

      // Sense-packet AGREGAT dibangun server dari state yang DIKIRIM klien —
      // server tidak punya state apa pun sendiri (amnesia, konstitusi hukum 1-2).
      const ctx = (args.context ?? {}) as Record<string, unknown>;
      const packet = [
        `SENSE-PACKET CREATURE ${meta.name.toUpperCase()} (via /api/mcp creature.dispatch) — agregat:`,
        `creature: ${meta.name} (${meta.species}) — peran ${meta.role}`,
        `energi: ${energy}/100 · kekayaan simulasi: ${wealth} · skill: ${skills.length} (${skills.slice(0, 4).join(", ") || "—"})`,
        `status: ${status} · denyut ke-${pulseCount} · jejak terakhir: ${lastTrace ?? "—"}`,
        `beat biosfer: ${typeof ctx.beat === "number" ? ctx.beat : 0} · vault: ${typeof ctx.totalRecords === "number" ? ctx.totalRecords : 0} rekaman, ±${typeof ctx.totalKb === "number" ? ctx.totalKb : 0} KB`,
        `waktu: ${typeof ctx.ts === "string" ? ctx.ts.slice(0, 40) : new Date().toISOString()}`,
        "Semua angka = agregat dari klien pemilik; server tidak menyimpan apa pun.",
        "TUGAS: putuskan SATU aksi sesuai peran Anda (ruang aksi di genom). Satu denyut = satu keputusan.",
      ].join("\n");

      const genome = buildGenome(organ, "FREE", {
        id: meta.id,
        name: meta.name,
        species: meta.species,
        role: meta.role,
        description: meta.description,
        traits: meta.traits,
        reflex: meta.reflex,
      });
      const r = await think(genome, packet);
      if (!r.decision) {
        return {
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { ok: false, error: r.error ?? "penalaran tidak menghasilkan keputusan sah", model: r.model, latencyMs: r.latencyMs, hint: "klien jatuh ke refleks lokal (konstitusi hukum 6)" },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          },
        };
      }
      const veto = vetoDecision(r.decision);
      return {
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: true,
                  decision: r.decision,
                  veto: veto.allowed ? { allowed: true } : { allowed: false, violations: veto.violations, replacement: veto.replacement },
                  note: "stateless: keputusan TIDAK disimpan server; eksekusi tetap di klien pemilik dengan veto lokal",
                },
                null,
                2,
              ),
            },
          ],
          meta: { model: r.model, latencyMs: r.latencyMs, stateless: true, zeroStorage: true },
        },
      };
    }

    case "world.map": {
      // Stateless murni: hanya dokumentasi hidup dunia — tidak ada state server.
      const payload = {
        ok: true,
        label: "peta dunia PLANET v1.2 — metafora visual dari data nyata; server amnesia, dunia hidup di klien pemilik",
        cara_membaca_peta: [
          "Planet = kanvas 2D top-down di view 08 PLANET: band langit konnektom di atas (182 bintang = neuron atlas; bima sakti = sinaps), 7 biome daratan sebagai region organik + band langit sebagai biome ke-8.",
          "Setiap denyut biosfer (±45 dtk, satu creature per denyut) menjalankan worldTick: produksi energi biome, grazing creature, kesuburan, iklim, posisi/mood creature — murni lokal, tanpa LLM/fetch.",
          "Klik biome → inspektor (kesuburan, stok energi, sinyal nyata yang menyalakannya, tombol buka fitur terkait). Klik creature → inspektor (energi, mood, biome, keputusan gerak, skill).",
          "Panel samping: IKLIM (hari/jam dunia, cuaca + alasan data, musim + verdict), JARING MAKANAN (aliran energi biome → creature → nutrisi), PETA SISTEM (wire table — klik untuk highlight).",
          "Nol penyimpanan: posisi & energi dunia persist HANYA ke settings vault lokal pemilik ('organism.world'); server tidak tahu apa-apa.",
        ].join("\n"),
        wire_table: WIRE_TABLE.map((w) => ({
          no: w.no,
          biome: w.biome,
          nama: w.nama,
          fitur_nyata: w.fitur,
          sinyal_input: w.sinyal,
          output_hidup: w.output,
        })),
        rumus_iklim: {
          siang_malam: "12 denyut = 1 hari dunia; hari = floor(beat/12) % 7 + 1 ('Hari 1..7'); jam dunia = (beat % 12) × 2; fase: fajar 5–7, siang 7–17, senja 17–19, malam sisanya. Malam: tint gelap kebiruan, creature tidur (kecuali prt patroli), drain energi −50%.",
          cuaca: "rasio kegagalan 20 denyut terakhir (decisionStream.error): <5% = CERAH, 5–20% = BERAWAN, >20% = BADAI (drain ×1,5, breaker lebih rapuh). Badai otomatis reda saat remediasi self-reflect sukses. Volume keputusan tinggi (buffer ≥30/50) = ANGIN (trail creature lebih panjang).",
          musim: "verdict self-reflect terakhir: ok = MUSIM HUJAN (produksi/kesuburan ×1,25), degraded = KEMARAU (×0,75), critical = KELAPARAN (produksi ×0,15; creature migrasi ke biome paling subur sesuai peran).",
          aliran_energi: "produksi biome ∝ sinyal nyata (delta rekaman vault, panggilan gerbang, quant tick, skill baru, kwitansi, reflect, breaker) × faktor musim × cuaca; creature menggembalakan stok biome (metabolisme); aksi creature menyetor nutrisi balik (kesuburan +); biome kosong → creature migrasi.",
        },
        rumah_creature: {
          prt: "Hutan Memori (patroli; ke Kutub saat badai)",
          tradio: "Pegunungan Kuant",
          scriba: "Kota Alat",
          lumen: "Kawah Riset",
          cresca: "Savana Tumbuh",
          fabro: "Kota Alat",
        },
        label_jujur: {
          wire_table: "[T] fitur nyata yang sudah berjalan",
          iklim: "[D] mekanisme desain baru yang mengubah data nyata jadi alam",
          migrasi: "[H] hipotesis perilaku yang divisualisasikan",
        },
        note: "stateless & zero-storage: endpoint ini TIDAK membaca/menyimpan state dunia siapa pun — ia hanya mendokumentasikan peta.",
      };
      return { result: { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] } };
    }

    default:
      return { error: { code: -32601, message: `tool '${name}' tidak dikenal — panggil tools/list untuk daftar sah` } };
  }
}

// ---------- Handlers ----------

async function handleRpc(req: Request, reqBody: RpcRequest) {
  const bearer = readBearer(req);
  const { method, id } = reqBody;
  const llmKey = llmClientKey(req, bearer.raw);

  if (method === "initialize") {
    const p = (reqBody.params ?? {}) as { protocolVersion?: unknown; clientInfo?: unknown };
    const requested = typeof p.protocolVersion === "string" ? p.protocolVersion : "";
    const protocolVersion = SUPPORTED_VERSIONS.includes(requested) ? requested : "2025-06-18";
    return rpcOk(id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions:
        "FLYBRAIN OS — SaaS otonom zero-storage. Semua tool bersifat stateless; tool memori (memory.write/recall) berjalan di perangkat pemilik. Bearer FK1_ diperiksa formatnya di sini; verifikasi penuh tetap di perangkat pemilik.",
    });
  }

  if (method === "tools/list") {
    return rpcOk(id, { tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
  }

  if (method === "tools/call") {
    const p = (reqBody.params ?? {}) as { name?: unknown; arguments?: unknown };
    const name = typeof p.name === "string" ? p.name : "";
    if (!name) {
      return rpcErr(id, { code: -32602, message: "invalid params — 'name' tool wajib ada" });
    }
    const tool = MCP_TOOLS.find((t) => t.name === name);
    if (!tool) {
      return rpcErr(id, { code: -32601, message: `tool '${name}' tidak dikenal — panggil tools/list untuk daftar sah` });
    }
    const args = (p.arguments ?? {}) as Record<string, unknown>;
    if (tool.auth === "bearer" && !bearer.validFormat) {
      return rpcErr(id, { code: -32001, message: "kunci API tidak valid — tool ini butuh header Authorization: Bearer FK1_<64 hex>" });
    }
    try {
      const out = await dispatchTool(name, args, bearer, llmKey);
      if (out.error) return rpcErr(id, out.error);
      return rpcOk(id, out.result);
    } catch (e) {
      return rpcErr(id, {
        code: -32603,
        message: "internal error saat mengeksekusi tool",
        data: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return rpcErr(id, { code: -32601, message: `method '${String(method)}' tidak dikenal — gunakan initialize | tools/list | tools/call` });
}

export async function POST(req: Request) {
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json(rpcErr(null, { code: -32700, message: "parse error — body tidak terbaca" }), { status: 400 });
  }

  let parsed: RpcRequest;
  try {
    parsed = JSON.parse(raw) as RpcRequest;
  } catch {
    return NextResponse.json(rpcErr(null, { code: -32700, message: "parse error — body bukan JSON sah" }), { status: 400 });
  }

  if (parsed.jsonrpc !== "2.0" || typeof parsed.method !== "string") {
    // Audit F-16: kesalahan ENVELOPE = -32600 (Invalid Request); -32602 khusus params tool.
    return NextResponse.json(
      rpcErr(parsed.id ?? null, { code: -32600, message: "invalid request — wajib { jsonrpc: \"2.0\", method: string }" }),
      { status: 200 },
    );
  }

  const response = await handleRpc(req, parsed);
  return NextResponse.json(response, { status: 200 });
}

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: SERVER_INFO,
      protocol: "JSON-RPC 2.0 over HTTP (MCP stateless)",
      stateless: true,
      zeroStorage: true,
      auth: "Authorization: Bearer FK1_<64 hex> (format-only di server; verifikasi penuh di perangkat pemilik)",
      methods: ["initialize", "tools/list", "tools/call"],
      tools: MCP_TOOLS.map((t) => t.name),
      hint: "POST JSON-RPC ke endpoint ini — contoh: {\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}",
    },
    { status: 200 },
  );
}
