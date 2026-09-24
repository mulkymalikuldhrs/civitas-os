// CIVITAS OS — action/route.ts
// Gateway aksi admin/demo. SEMUA aksi tetap lewat policy engine — tidak ada pintu belakang.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { heartbeatTick } from "@/lib/civos/runtime";
import { cachedStatus } from "@/lib/civos/minecraft";
import { emit } from "@/lib/civos/events";
import { grant } from "@/lib/civos/policy";
import { EVENT_TYPES } from "@/lib/civos/types";

export const dynamic = "force-dynamic";

interface Body {
  action?: string;
  params?: {
    orgCode?: string;
    capitalAsk?: number;
    name?: string;
    specialization?: string;
    confirm?: string;
    counterparty?: string;
    amount?: number;
    reference?: string;
    env?: string;
    count?: number;
    item?: string;
    unitPrice?: number;
    qty?: number;
    // SLICE 9 — toolforge
    tool?: string;
    villagerCode?: string;
    query?: string;
    url?: string;
    structure?: string;
    product?: string;
    unit?: string;
    // SLICE 10 — chat, config, console, mcp
    body?: string;
    senderName?: string;
    key?: string;
    value?: string;
    transport?: string;
    envJson?: string;
    mcpTool?: string;
    args?: Record<string, unknown>;
    // SLICE 11 — server registry
    serverId?: string;
    edition?: string;
    host?: string;
    port?: number;
  };
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "body JSON tidak valid" }, { status: 400 });
  }
  const p = body.params ?? {};

  try {
    switch (body.action) {
      case "tick": {
        const summary = await heartbeatTick(p.orgCode);
        return NextResponse.json({ ok: true, summary });
      }

      case "register_company": {
        // Registrasi baru oleh PEMERINTAH (manusia memicu, institusi REGULATORY tetap memvalidasi).
        const name = (p.name ?? "").trim();
        if (!name) return NextResponse.json({ ok: false, error: "nama perusahaan wajib" }, { status: 400 });
        const count = (await db.civOrg.count({ where: { kind: "COMPANY" } })) + 1;
        const code = `COMP-${String(count).padStart(3, "0")}`;
        const org = await db.civOrg.create({
          data: { code, kind: "COMPANY", name, lifecycle: "PROPOSED", specialization: p.specialization ?? "Umum", parentOrgId: (await db.civOrg.findUnique({ where: { code: "NUSANTARA" } }))?.id },
        });
        await db.civAccount.create({ data: { orgId: org.id, kind: "OPERATING", name: `Kas Operasional ${code}` } });
        await db.civAccount.create({ data: { orgId: org.id, kind: "INCOME", name: `Pendapatan ${code}` } });
        await db.civAccount.create({ data: { orgId: org.id, kind: "EXPENSE", name: `Beban ${code}` } });
        const ceo = await db.civAgent.create({
          data: { code: `CEO-${code.slice(-3)}`, name: `Kepala ${name}`, role: "CEO", orgId: org.id, authority: JSON.stringify({ produksi: true, invoice: true }), budgetCap: 100_000 },
        });
        await grant(ceo.id, "ledger.post", 50_000);
        await grant(ceo.id, "memory.write", 0);
        await emit({ type: EVENT_TYPES.COMPANY_PROPOSED, subjectType: "COMPANY", subjectId: org.id, payload: { kode: code, nama: name, spesialisasi: p.specialization ?? "Umum" } });
        return NextResponse.json({ ok: true, org: { code, name }, note: "PROPOSED — menunggu institusi REGULATORY meregistrasi lewat denyut" });
      }

      case "ping_minecraft": {
        const st = await cachedStatus(true);
        return NextResponse.json({ ok: true, status: st });
      }

      case "mc_join": {
        const { attemptBotJoin } = await import("@/lib/civos/mcbot");
        const r = await attemptBotJoin(true);
        return NextResponse.json({ ok: r.joined, ...r });
      }

      case "settle_external": {
        const { settleExternal } = await import("@/lib/civos/settle");
        const counterparty = (p.counterparty ?? "").trim();
        const amount = Math.trunc(Number(p.amount ?? 0));
        const r = await settleExternal({
          orgCode: p.orgCode,
          counterparty,
          amount,
          reference: (p.reference ?? "").trim(),
          env: p.env === "live" ? "live" : "sandbox",
        });
        return NextResponse.json({ ...r, ok: r.ok }, { status: r.ok ? 200 : 422 });
      }

      case "create_city": {
        const { createCity } = await import("@/lib/civos/expand");
        const name = (p.name ?? "").trim();
        if (!name) return NextResponse.json({ ok: false, error: "nama kota wajib" }, { status: 400 });
        const r = await createCity(name, p.specialization ?? "Kota baru peradaban");
        return NextResponse.json({ ...r, ok: r.ok }, { status: r.ok ? 200 : 422 });
      }

      case "create_quant_office": {
        const { createQuantOffice } = await import("@/lib/civos/expand");
        const r = await createQuantOffice();
        return NextResponse.json({ ...r, ok: r.ok }, { status: r.ok ? 200 : 422 });
      }

      // SLICE 7 — VILLAGER ASCENSION
      case "village_census": {
        // Sensus SIMULASI berlabel jujur — pipeline desa hidup saat server MC tidur.
        const { createCensus } = await import("@/lib/civos/villagers");
        const count = Math.max(1, Math.min(12, Math.trunc(Number(p.count ?? 8))));
        const r = await createCensus(count, "SIMULASI");
        return NextResponse.json({ ...r, ok: r.created.length > 0 || r.retired > 0 });
      }

      case "village_tick": {
        // Paksa SATU denyut warga sekarang (round-robin tetap dihormati).
        const { villagePulseNext } = await import("@/lib/civos/village");
        const r = await villagePulseNext(true);
        return NextResponse.json({ ok: r.ran, ...r });
      }

      case "village_retire_sim": {
        // Warga SIMULASI mundur (menunggu sensus NYATA).
        const { retireSimVillagers } = await import("@/lib/civos/villagers");
        const retired = await retireSimVillagers();
        return NextResponse.json({ ok: true, retired, note: retired > 0 ? `${retired} warga SIMULASI mundur — menunggu sensus CENSUS dari dunia` : "tidak ada warga SIMULASI aktif" });
      }

      // SLICE 8 — VILLAGER EMBODIMENT (tubuh) + PASAR DESA
      case "village_directive_run_sim": {
        // Mimpi jaga: jalankan antrean tubuh di kernel (dunia OFFLINE — berlabel SIM jujur).
        const { runSimDirectives } = await import("@/lib/civos/directives");
        const r = await runSimDirectives(false);
        return NextResponse.json({ ok: true, ...r });
      }

      // SLICE 9 — TOOLFORGE: panggil tool NYATA atas nama warga (charter divisi tetap
      // ditegakkan — pintu admin BUKAN pintu belakang).
      case "tool_run": {
        const { invokeTool } = await import("@/lib/civos/tools");
        const toolKey = (p.tool ?? "").trim();
        if (!toolKey) return NextResponse.json({ ok: false, error: "params.tool wajib" }, { status: 400 });
        let villager = null as null | { id: string; code: string; name: string; division: string; mcCoords: string; workOrgId: string | null };
        if (p.villagerCode) {
          villager = await db.civVillager.findFirst({
            where: { code: p.villagerCode.trim(), status: "ACTIVE" },
            select: { id: true, code: true, name: true, division: true, mcCoords: true, workOrgId: true },
          });
          if (!villager) return NextResponse.json({ ok: false, error: `warga ${p.villagerCode} tidak ditemukan/aktif` }, { status: 404 });
        } else {
          // Cursor: warga aktif berikutnya yang punya charter tool tsb.
          const { divisionMeta, DIVISIONS } = await import("@/lib/civos/types");
          const eligible = DIVISIONS.filter((d) => divisionMeta(d).tools.includes(toolKey));
          villager = await db.civVillager.findFirst({
            where: { status: "ACTIVE", division: { in: eligible } },
            orderBy: { updatedAt: "asc" },
            select: { id: true, code: true, name: true, division: true, mcCoords: true, workOrgId: true },
          });
          if (!villager) return NextResponse.json({ ok: false, error: `tidak ada warga aktif dengan charter ${toolKey} — jalankan sensus dulu` }, { status: 404 });
        }
        const input: Record<string, unknown> = {};
        if (p.query) input.query = p.query;
        if (p.url) input.url = p.url;
        if (p.structure) input.structure = p.structure;
        if (p.product) input.product = p.product;
        if (p.unit) input.unit = p.unit;
        if (toolKey === "mine_route") input.sellerOrgId = villager.workOrgId;
        const r = await invokeTool({ type: "VILLAGER", id: villager.id, code: villager.code, name: villager.name, division: villager.division, mcCoords: villager.mcCoords }, toolKey, input);
        return NextResponse.json({ ...r, ok: r.ok, oleh: `${villager.name} (${villager.code}, guild ${villager.division})` }, { status: r.ok ? 200 : 422 });
      }

      case "market_list": {
        // Listing manual (demo/admin) — tetap lewat policy MARKET_*.
        const { listOffer } = await import("@/lib/civos/market");
        const org = await db.civOrg.findUnique({ where: { code: (p.orgCode ?? "").trim() } });
        if (!org) return NextResponse.json({ ok: false, error: "perusahaan tidak ditemukan" }, { status: 404 });
        const r = await listOffer(org.id, (p.item ?? "").trim() || "Hasil produksi", Math.trunc(Number(p.unitPrice ?? 30)), Math.trunc(Number(p.qty ?? 4)));
        return NextResponse.json({ ...r, ok: r.ok }, { status: r.ok ? 200 : 422 });
      }

      case "declare_external_customer": {
        // Kejujuran radikal: revenue eksternal palsu TIDAK BOLEH dibuat.
        return NextResponse.json({
          ok: false,
          code: "HONESTY_GATE",
          error: "Revenue eksternal butuh customer NYATA di luar peradaban (pembayaran terverifikasi). Simulasi tidak boleh dicatat sebagai revenue eksternal. Sambungkan rail pembayaran riil (Slice 6) untuk mengaktifkan jalur ini.",
        }, { status: 422 });
      }

      // SLICE 10 — CHAT: bicara langsung dengan warga (otak LLM + relay dunia)
      // SLICE 11 — villagerCode kini opsional: bila kosong, warga aktif pertama yang membalas.
      case "chat_send": {
        const { askCitizen } = await import("@/lib/civos/chat");
        const body = (p.body ?? "").trim();
        if (!body) return NextResponse.json({ ok: false, error: "params.body wajib" }, { status: 400 });
        let code = (p.villagerCode ?? "").trim();
        if (!code) {
          const v = await db.civVillager.findFirst({ where: { status: "ACTIVE" }, orderBy: { code: "asc" }, select: { code: true } });
          if (!v) return NextResponse.json({ ok: false, error: "belum ada warga aktif — jalankan census" }, { status: 404 });
          code = v.code;
        }
        const r = await askCitizen({ villagerCode: code, body, channel: "DASHBOARD", senderName: p.senderName ?? "Pemilik" });
        return NextResponse.json({ ...r, ok: r.ok }, { status: r.ok ? 200 : 422 });
      }

      // SLICE 10 — KONFIGURASI: baca/tulis nilai runtime (SECRET dimask saat baca)
      case "config_put": {
        const { setConfigValue } = await import("@/lib/civos/config");
        if (!p.key) return NextResponse.json({ ok: false, error: "params.key wajib" }, { status: 400 });
        const r = await setConfigValue(p.key.trim(), String(p.value ?? ""));
        return NextResponse.json({ ...r, ok: r.ok, note: r.ok ? `${p.key} tersimpan (efektif segera)` : undefined }, { status: r.ok ? 200 : 422 });
      }

      case "config_test": {
        // Uji koneksi nyata: supabase (mandat #9) atau ping minecraft
        const which = (p.key ?? "supabase").trim();
        if (which === "supabase") {
          const { supabaseTest } = await import("@/lib/civos/supabase");
          const r = await supabaseTest();
          return NextResponse.json({ ok: r.failed === 0, ...r });
        }
        if (which === "minecraft") {
          const st = await cachedStatus(true);
          return NextResponse.json({ ok: st.online, status: st });
        }
        return NextResponse.json({ ok: false, error: `uji tidak dikenal: ${which} (pilihan: supabase, minecraft)` }, { status: 400 });
      }

      // SLICE 10 — KONSOL SERVER LOKAL (PMMP): jalankan perintah dunia (audit penuh)
      case "mc_console": {
        const { localConsoleCommand } = await import("@/lib/civos/console");
        const command = (p.body ?? p.query ?? "").trim();
        if (!command) return NextResponse.json({ ok: false, error: "params.body wajib (perintah)" }, { status: 400 });
        const r = await localConsoleCommand(command, "UI");
        return NextResponse.json({ ok: r.ok, response: r.response });
      }

      // SLICE 10 — MCP: daftar/tambah/hapus/panggil server MCP nyata
      case "mcp_add": {
        const { addMcpServer } = await import("@/lib/civos/mcp");
        const r = await addMcpServer({ name: p.name ?? p.item ?? "", transport: p.transport ?? "HTTP", endpoint: p.value ?? p.url ?? "", envJson: p.envJson });
        return NextResponse.json({ ...r, ok: r.ok }, { status: r.ok ? 200 : 422 });
      }

      case "mcp_remove": {
        const { removeMcpServer } = await import("@/lib/civos/mcp");
        const r = await removeMcpServer((p.name ?? "").trim());
        return NextResponse.json({ ...r, ok: r.ok }, { status: r.ok ? 200 : 422 });
      }

      case "mcp_call": {
        const { mcpCall } = await import("@/lib/civos/mcp");
        const { invokeTool } = await import("@/lib/civos/tools");
        const serverName = (p.name ?? "").trim();
        const mcpTool = (p.mcpTool ?? "").trim();
        if (!serverName) return NextResponse.json({ ok: false, error: "params.name (server) wajib" }, { status: 400 });
        // Jalur lewat Toolforge agar charter + audit tetap ditegakkan (pintu admin BUKAN pintu belakang).
        const { DIVISIONS, divisionMeta } = await import("@/lib/civos/types");
        const eligible = DIVISIONS.filter((d) => divisionMeta(d).tools.includes("mcp_call"));
        const villager = await db.civVillager.findFirst({
          where: { status: "ACTIVE", division: { in: eligible } },
          orderBy: { updatedAt: "asc" },
          select: { id: true, code: true, name: true, division: true, mcCoords: true, workOrgId: true },
        });
        if (!villager) return NextResponse.json({ ok: false, error: "tidak ada warga aktif dengan charter mcp_call" }, { status: 404 });
        const input: Record<string, unknown> = { server: serverName };
        if (mcpTool) { input.mcpTool = mcpTool; input.args = p.args ?? {}; }
        const r = await invokeTool({ type: "VILLAGER", id: villager.id, code: villager.code, name: villager.name, division: villager.division, mcCoords: villager.mcCoords }, "mcp_call", input);
        return NextResponse.json({ ...r, ok: r.ok, oleh: `${villager.name} (${villager.code})` }, { status: r.ok ? 200 : 422 });
      }

      // SLICE 10 — SUMMON villager desa via konsol (dunia lokal)
      case "mc_summon": {
        const { localConsoleCommand } = await import("@/lib/civos/console");
        const count = Math.max(1, Math.min(12, Math.trunc(Number(p.count ?? 8))));
        const r = await localConsoleCommand(`civ summon ${count}`, "UI");
        return NextResponse.json({ ok: r.ok, response: r.response });
      }

      // SLICE 11 — SELF-LIFE & MULTI-SERVER: config baca, aksi server, backup, sync, detak
      case "config_get": {
        const { configView } = await import("@/lib/civos/config");
        if (!p.key) return NextResponse.json({ ok: false, error: "params.key wajib" }, { status: 400 });
        const cfg = await configView();
        const f = cfg.fields.find((x) => x.key === p.key!.trim());
        if (!f) return NextResponse.json({ ok: false, error: `field tidak dikenal: ${p.key}` }, { status: 404 });
        return NextResponse.json({ ok: true, key: f.key, value: f.value, masked: f.masked, set: f.set });
      }

      case "server_action": {
        const { serverAction } = await import("@/lib/civos/servers");
        const id = (p.key ?? p.item ?? "").trim();
        const act = (p.value ?? "status").trim();
        if (!id) return NextResponse.json({ ok: false, error: "params.key = id server wajib" }, { status: 400 });
        if (!["start", "stop", "restart", "status"].includes(act)) return NextResponse.json({ ok: false, error: "params.value = start|stop|restart|status" }, { status: 400 });
        const r = await serverAction(id, act as "start" | "stop" | "restart" | "status");
        return NextResponse.json(r, { status: r.ok ? 200 : 400 });
      }

      // SLICE 11 — registry editable: tambah/ hapus server (edisi lain, proxy, cluster)
      case "server_add": {
        const { upsertServer } = await import("@/lib/civos/servers");
        const r = await upsertServer({
          id: (p.serverId ?? "").trim(),
          label: (p.name ?? p.serverId ?? "").trim(),
          edition: (p.edition ?? "BEDROCK").trim().toUpperCase() === "JAVA" ? "JAVA" : "BEDROCK",
          host: (p.host ?? "127.0.0.1").trim(),
          port: Math.trunc(Number(p.port ?? 0)),
          managed: false,
          note: "ditambahkan via UI/API",
        });
        return NextResponse.json({ ...r }, { status: r.ok ? 200 : 422 });
      }

      case "server_remove": {
        const { removeServer } = await import("@/lib/civos/servers");
        const r = await removeServer((p.serverId ?? "").trim());
        return NextResponse.json({ ...r }, { status: r.ok ? 200 : 404 });
      }

      case "backup_run": {
        const { backupAll } = await import("@/lib/civos/selflife");
        const r = await backupAll();
        return NextResponse.json({ ...r, ok: r.ok }, { status: r.ok ? 200 : 500 });
      }

      case "backup_cloud_upload": {
        const { backupToCloud } = await import("@/lib/civos/selflife");
        const r = await backupToCloud(typeof p.file === "string" ? p.file : undefined);
        return NextResponse.json({ ...r, ok: r.ok }, { status: r.ok ? 200 : 500 });
      }

      case "backup_restore": {
        const { restoreBackup } = await import("@/lib/civos/selflife");
        const scope = p.scope === "worlds" ? "worlds" : "full";
        const r = await restoreBackup(String(p.file ?? ""), scope);
        return NextResponse.json({ ...r, ok: r.ok }, { status: r.ok ? 200 : 500 });
      }

      case "backup_cloud_restore": {
        const { restoreFromCloud } = await import("@/lib/civos/selflife");
        const scope = p.scope === "worlds" ? "worlds" : "full";
        const r = await restoreFromCloud(String(p.file ?? ""), scope);
        return NextResponse.json({ ...r, ok: r.ok }, { status: r.ok ? 200 : 500 });
      }

      case "git_sync": {
        const { gitSync } = await import("@/lib/civos/selflife");
        const r = await gitSync();
        return NextResponse.json({ ...r, ok: r.ok }, { status: r.ok ? 200 : 500 });
      }

      case "selflife_tick": {
        const { selfLifeTick } = await import("@/lib/civos/selflife");
        const r = await selfLifeTick();
        return NextResponse.json({ ok: true, ...r });
      }

      case "reset": {
        if (p.confirm !== "RESET-CIVOS") {
          return NextResponse.json({ ok: false, error: "butuh params.confirm = 'RESET-CIVOS'" }, { status: 403 });
        }
        // Urutan hapus mengikuti ketergantungan FK.
        await db.civEntry.deleteMany({});
        await db.civTxn.deleteMany({});
        await db.civGrant.deleteMany({});
        await db.civTask.deleteMany({});
        await db.civProposal.deleteMany({});
        await db.civMemory.deleteMany({});
        await db.civWorldEntity.deleteMany({});
        await db.civArtifact.deleteMany({}); // SLICE 9 — artefak guild
        await db.civToolCall.deleteMany({}); // SLICE 9 — audit toolforge
        await db.civVillagerDirective.deleteMany({}); // SLICE 8 — direktif menunjuk warga
        await db.civMarketOffer.deleteMany({}); // SLICE 8 — pasar desa
        await db.civChatMessage.deleteMany({}); // SLICE 10 — log chat
        await db.civConsoleLog.deleteMany({}); // SLICE 10 — audit konsol
        await db.civMcpServer.deleteMany({}); // SLICE 10 — registry MCP
        await db.civVillager.deleteMany({});
        await db.civAgent.deleteMany({});
        await db.civAccount.deleteMany({});
        await db.civOrg.deleteMany({});
        await db.civEvent.deleteMany({});
        await db.civKV.deleteMany({});
        return NextResponse.json({ ok: true, note: "kernel dikosongkan; seed ulang otomatis pada GET berikutnya" });
      }

      default:
        return NextResponse.json({ ok: false, error: `aksi tidak dikenal: ${body.action ?? "-"}` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "aksi gagal" }, { status: 500 });
  }
}
