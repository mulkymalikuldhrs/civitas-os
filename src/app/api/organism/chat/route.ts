// FLYBRAIN OS — /api/organism/chat (STATELESS, AMNESIA)
// Jawab SEBAGAI prt: system prompt genom + konteks agregat → jawaban teks.
// Tidak ada penyimpanan: pesan masuk, jawaban keluar, server lupa.

import { NextResponse } from "next/server";
import { thinkChat } from "@/lib/flybrain/organism/brain";
import { allowLlmCall, llmClientKey, LLM_BUDGET_LABEL } from "@/lib/flybrain/llm-budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatBody {
  message?: unknown;
  context?: unknown;
}

export async function POST(req: Request) {
  const ts = new Date().toISOString();
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Body bukan JSON sah.", ts }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ ok: false, error: "Field 'message' wajib ada.", ts }, { status: 400 });
  }

  // Budget LLM per-instance (audit F-08): guard in-memory per bearer/IP.
  // Stateless tetap amnesia — hitungan hidup di RAM proses, tidak pernah persist.
  if (!allowLlmCall(llmClientKey(req, null))) {
    return NextResponse.json(
      {
        ok: false,
        error: `Budget instance tercapai — coba lagi nanti (${LLM_BUDGET_LABEL}). Server tetap tidak menyimpan apa pun.`,
        ts,
      },
      { status: 429 },
    );
  }

  const result = await thinkChat(message, body.context ?? null);
  if (!result.reply) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "jawaban kosong", model: result.model, latencyMs: result.latencyMs, ts },
      { status: 200 },
    );
  }

  return NextResponse.json(
    { ok: true, reply: result.reply, model: result.model, latencyMs: result.latencyMs, ts },
    { status: 200 },
  );
}

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      endpoint: "/api/organism/chat",
      method: "POST",
      stateless: true,
      zeroStorage: true,
      body: { message: "string", context: "objek agregat opsional" },
    },
    { status: 200 },
  );
}
