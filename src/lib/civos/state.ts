// CIVITAS OS — state.ts
// Agregator keadaan peradaban untuk UI/API. Auto-seed saat kosong.

import { db } from "@/lib/db";
import { ensureSeed } from "./seed";
import { getAccounts } from "./accounts";
import { recentEvents } from "./events";
import { ledgerRows, accountBalance } from "./ledger";
import { listPolicies } from "./policy";
import { computeMetrics } from "./economy";
import { recentTicks } from "./runtime";
import { worldEntities } from "./minecraft";
import { villageStats } from "./villagers";
import { directiveStats } from "./directives";
import { openOffers, marketStats } from "./market";
import { guildStats, toolStats, recentToolCalls, recentArtifacts, artifactCount } from "./tools";
import { recentChat } from "./chat";
import { listMcpServers } from "./mcp";
import { consoleLog } from "./console";
import { configView } from "./config";
import { cachedServerStatuses } from "./servers";
import { selfLifeStatus } from "./selflife";
import { KV_LAST_TICK } from "./types";
import { mcTarget } from "./config";
import { safeParse } from "./events";

export async function civState() {
  const seed = await ensureSeed();

  const orgs = await db.civOrg.findMany({ orderBy: [{ kind: "asc" }, { code: "asc" }] });
  const orgRows: { id: string; code: string; kind: string; name: string; lifecycle: string; specialization: string | null; createdAt: string; accounts: { id: string; kind: string; name: string; balance: number }[] }[] = [];
  for (const o of orgs) {
    orgRows.push({
      id: o.id,
      code: o.code,
      kind: o.kind,
      name: o.name,
      lifecycle: o.lifecycle,
      specialization: o.specialization,
      createdAt: o.createdAt.toISOString(),
      accounts: o.kind === "NATION" ? [] : await getAccounts(o.id),
    });
  }

  const agents = await db.civAgent.findMany({ include: { org: true, grants: true }, orderBy: { code: "asc" } });
  const agentRows = agents.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    role: a.role,
    orgCode: a.org.code,
    orgKind: a.org.kind,
    status: a.status,
    reputation: a.reputation,
    budgetCap: a.budgetCap,
    grants: (a.grants ?? []).length,
  }));

  const proposals = await db.civProposal.findMany({ include: { org: true }, orderBy: { createdAt: "desc" }, take: 24 });
  const proposalRows = proposals.map((p) => ({
    id: p.id,
    kind: p.kind,
    orgCode: p.org?.code ?? null,
    institution: p.institution,
    status: p.status,
    payload: safeParse(p.payload),
    policyCheck: safeParse(p.policyCheck),
    reason: p.reason,
    decidedBy: p.decidedBy,
    createdAt: p.createdAt.toISOString(),
  }));

  const tasks = await db.civTask.findMany({ include: { agent: true, org: true }, orderBy: { createdAt: "desc" }, take: 15 });
  const taskRows = tasks.map((t) => ({
    id: t.id,
    agentCode: t.agent.code,
    orgCode: t.org.code,
    type: t.type,
    status: t.status,
    route: safeParse(t.route),
    result: safeParse(t.result),
    createdAt: t.createdAt.toISOString(),
  }));

  const memories = await db.civMemory.findMany({ orderBy: { createdAt: "desc" }, take: 16 });
  const memoryRows = memories.map((m) => ({
    id: m.id,
    ownerType: m.ownerType,
    ownerId: m.ownerId,
    scope: m.scope,
    visibility: m.visibility,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));

  const lastTickRow = await db.civKV.findUnique({ where: { key: KV_LAST_TICK } });
  const lastTick = lastTickRow ? safeParse(lastTickRow.value) : null;

  // SLICE 7 — blok desa (warga = villager Minecraft yang naik derajat)
  const villagersActive = await db.civVillager.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" }, include: { workOrg: true } });
  const villagerRows: { code: string; name: string; profession: string; profKey: string; role: string; division: string; source: string; embodiment: string; village: string; mood: string; xp: number; socialScore: number; wallet: number; workOrg: string | null; lastAction: string | null; lastActionAt: string | null; coords: string | null }[] = [];
  for (const v of villagersActive) {
    const bal = v.walletId ? await accountBalance(v.walletId) : 0;
    villagerRows.push({
      code: v.code,
      name: v.name,
      profession: v.profLabel,
      profKey: v.profession,
      role: v.role,
      division: v.division,
      source: v.source,
      embodiment: v.embodiment,
      village: v.village,
      mood: v.mood,
      xp: v.xp,
      socialScore: v.socialScore,
      wallet: bal,
      workOrg: v.workOrg?.code ?? null,
      lastAction: v.lastAction,
      lastActionAt: v.lastActionAt?.toISOString() ?? null,
      coords: v.mcCoords === "{}" ? null : v.mcCoords,
    });
  }
  const village = {
    ...(await villageStats()),
    retired: await db.civVillager.count({ where: { status: "RETIRED" } }),
    villagers: villagerRows,
    wagesPaid: await db.civTxn.count({ where: { txType: "WAGE" } }),
    // SLICE 8 — tubuh warga (direktif) + pasar desa
    directives: await directiveStats(),
    market: { ...(await marketStats()), offers: await openOffers(8) },
  };

  const [events, ledger, policies, metrics, ticks, entities] = await Promise.all([
    recentEvents(60),
    ledgerRows(30),
    listPolicies(),
    computeMetrics(),
    recentTicks(14),
    worldEntities(),
  ]);

  const grants = await db.civGrant.findMany({ include: { agent: true } });
  const grantRows = grants.map((g) => ({ agentCode: g.agent.code, capability: g.capabilityKey, budgetCap: g.budgetCap, expiresAt: g.expiresAt?.toISOString() ?? null }));

  // Cache status Minecraft TANPA ping (ping dilakukan heartbeat & endpoint minecraft)
  const mcRow = await db.civKV.findUnique({ where: { key: "minecraft.cache" } });
  const mcStatus = mcRow ? safeParse(mcRow.value) : { online: false, checkedAt: null, note: "belum ada ping — jalankan denyut" };

  const counts = {
    orgs: orgs.length,
    agents: agents.length,
    events: await db.civEvent.count(),
    txns: await db.civTxn.count(),
    memories: await db.civMemory.count(),
    tasks: await db.civTask.count(),
    artifacts: await artifactCount(),
    toolCalls: await db.civToolCall.count(),
  };

  // SLICE 9 — GUILD & TOOLFORGE
  const [guild, toolReg, toolCalls, artifacts] = await Promise.all([
    guildStats(),
    toolStats(),
    recentToolCalls(12),
    recentArtifacts(12),
  ]);

  const chat = await recentChat(30);
  const mcpServers = await listMcpServers();
  const consoleRows = await consoleLog(12);
  const cfg = await configView();

  return {
    seed,
    orgs: orgRows,
    agents: agentRows,
    proposals: proposalRows,
    tasks: taskRows,
    memories: memoryRows,
    events,
    ledger,
    policies,
    metrics,
    ticks,
    entities,
    grants: grantRows,
    village,
    guild,
    tools: { stats: toolReg, calls: toolCalls, artifacts },
    chat,
    mcp: mcpServers,
    console: consoleRows,
    config: cfg,
    mcStatus,
    mcServer: await mcTarget(),
    // SLICE 11 — MULTI-SERVER + SELF-LIFE
    servers: await cachedServerStatuses(),
    selfLife: await selfLifeStatus(),
    lastTick,
    counts,
    serverTime: new Date().toISOString(),
  };
}
