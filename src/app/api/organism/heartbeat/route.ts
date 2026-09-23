// FLYBRAIN OS — /api/organism/heartbeat (STATELESS, AMNESIA)
// Menerima sense-packet AGREGAT dari klien, menalar via LLM, mengembalikan keputusan.
// TIDAK menyimpan apa pun — tidak ada DB, tidak ada file, tidak ada cache konteks.
// v1.1 (additif, backward-compatible): body opsional `creatureId` + `role` —
// divalidasi terhadap katalog CREATURES (data murni) dan genom prompt menyesuaikan
// peran creature BIOSFER. Tanpa creature = perilaku v1.0 utuh (prt).

import { NextResponse } from "next/server";
import { buildGenome, think } from "@/lib/flybrain/organism/brain";
import { isOrganId } from "@/lib/flybrain/organism/loops";
import { CREATURES, creatureMeta, roleOrgan } from "@/lib/flybrain/organism/creatures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HeartbeatBody {
  organ?: unknown;
  sensePacket?: unknown;
  tier?: unknown;
  ts?: unknown;
  creatureId?: unknown;
  role?: unknown;
}

export async function POST(req: Request) {
  const ts = new Date().toISOString();
  let body: HeartbeatBody;
  try {
    body = (await req.json()) as HeartbeatBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Body bukan JSON sah.", ts }, { status: 400 });
  }

  const { organ, sensePacket, tier, ts: clientTs, creatureId, role } = body;
  if (!isOrganId(organ)) {
    return NextResponse.json(
      { ok: false, error: "organ wajib salah satu dari guardian|merchant|envoy|scout.", ts },
      { status: 400 },
    );
  }
  if (typeof sensePacket !== "string" || sensePacket.length < 8) {
    return NextResponse.json({ ok: false, error: "sensePacket (string) wajib ada.", ts }, { status: 400 });
  }

  // v1.1: validasi creatureId + role terhadap katalog server-side (data murni).
  // Keduanya opsional; bila creatureId ada dan role tidak, role diambil dari katalog.
  let creature: (typeof CREATURES)[number] | null = null;
  if (creatureId !== undefined && creatureId !== null) {
    if (typeof creatureId !== "string" || !CREATURES.some((c) => c.id === creatureId)) {
      return NextResponse.json(
        { ok: false, error: `creatureId tidak dikenal — katalog: ${CREATURES.map((c) => c.id).join(", ")}.`, ts },
        { status: 400 },
      );
    }
    creature = creatureMeta(creatureId);
    if (role !== undefined && role !== null) {
      if (typeof role !== "string" || creature.role !== role) {
        return NextResponse.json(
          { ok: false, error: `role '${String(role)}' tidak cocok dengan katalog creature '${creature.id}' (role sah: ${creature.role}).`, ts },
          { status: 400 },
        );
      }
    }
    // Konsistensi organ: creature role memetakan ke organ v1.0 tertentu.
    if (organ !== roleOrgan(creature.role)) {
      return NextResponse.json(
        { ok: false, error: `organ '${organ}' tidak cocok dengan creature '${creature.id}' (organ sah: ${roleOrgan(creature.role)}).`, ts },
        { status: 400 },
      );
    }
  } else if (role !== undefined && role !== null) {
    return NextResponse.json(
      { ok: false, error: "role hanya valid bersama creatureId (katalog creature).", ts },
      { status: 400 },
    );
  }

  // Guard privasi: paksa paket tetap kecil (agregat); server tidak perlu lebih.
  const packet = sensePacket.slice(0, 8000);
  const tierStr = typeof tier === "string" && tier ? tier.slice(0, 16) : "FREE";

  const genome = creature
    ? buildGenome(organ, tierStr, {
        id: creature.id,
        name: creature.name,
        species: creature.species,
        role: creature.role,
        description: creature.description,
        traits: creature.traits,
        reflex: creature.reflex,
      })
    : buildGenome(organ, tierStr);

  const result = await think(genome, {
    organ,
    ...(creature ? { creatureId: creature.id, role: creature.role } : {}),
    tier: tierStr,
    ts: typeof clientTs === "string" ? clientTs.slice(0, 40) : ts,
    sensePacket: packet,
  });

  if (!result.decision) {
    // Degradasi jujur (konstitusi poin 6): klien akan jatuh ke mode refleks.
    return NextResponse.json(
      { ok: false, error: result.error ?? "penalaran tidak menghasilkan keputusan sah", model: result.model, latencyMs: result.latencyMs, ts },
      { status: 200 },
    );
  }

  return NextResponse.json(
    { ok: true, decision: result.decision, model: result.model, latencyMs: result.latencyMs, ts },
    { status: 200 },
  );
}

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      endpoint: "/api/organism/heartbeat",
      method: "POST",
      stateless: true,
      zeroStorage: true,
      body: {
        organ: "guardian|merchant|envoy|scout",
        sensePacket: "string agregat",
        tier: "FREE|PRO",
        creatureId: "(opsional v1.1) prt|tradio|scriba|lumen|cresca|fabro",
        role: "(opsional v1.1) role katalog creature",
        ts: "ISO",
      },
      creatures: CREATURES.map((c) => ({ id: c.id, role: c.role, organ: roleOrgan(c.role) })),
    },
    { status: 200 },
  );
}
