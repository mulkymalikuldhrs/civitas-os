"use client";
// CIVITAS OS — PlayView (v1.5 "CITADEL")
// MINECRAFT ASLI DI BROWSER: klien sungguhan (prismarine-web-client, Protokol Minecraft
// penuh) berjalan dalam iframe tersambung ke server Paper kita via jembatan WS->TCP
// (mini-service mc-net-proxy, whitelist 127.0.0.1:25565). Bukan simulasi — dunia, chat,
// blok, dan gerak adalah data server nyata. Fullscreen toggle + auto-fit semua layar.

import { useCallback, useEffect, useRef, useState } from "react";
import { MCBadge, MCButton, MCPanel, MCSectionTitle } from "../mcui";
import { useCiv } from "../McShell";

export default function PlayView() {
  const { act } = useCiv();
  const [mounted, setMounted] = useState(false);
  const [full, setFull] = useState(false);
  const [javaOnline, setJavaOnline] = useState<boolean | null>(null);
  const [javaInfo, setJavaInfo] = useState<string>("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // status Paper (per 6 dtk)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/civos/servers", { cache: "no-store" });
        const j = (await res.json()) as { servers?: Array<{ id: string; online: boolean; version?: string; players?: number; motd?: string }> };
        if (!alive) return;
        const jv = (j.servers ?? []).find((x) => x.id === "local-java");
        setJavaOnline(jv?.online ?? false);
        setJavaInfo(jv?.online ? `${jv.version ?? ""} · ${jv.players ?? 0} pemain` : "offline — nyalakan dari tab SERVER");
      } catch { /* poll berikutnya */ }
    };
    void load();
    const t = setInterval(() => void load(), 6000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // sinkron status fullscreen
  useEffect(() => {
    const onChange = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFull = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (wrapRef.current) await wrapRef.current.requestFullscreen();
    } catch { /* browser menolak — pengguna tetap bisa pakai tombol layar penuh browser */ }
  }, []);

  return (
    <div className="grid gap-4">
      <MCPanel dark>
        <MCSectionTitle>MINECRAFT ASLI — MAIN LANGSUNG DARI BROWSER</MCSectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <MCBadge tone={javaOnline ? "green" : "red"}>{javaOnline ? `PAPER HIDUP · ${javaInfo}` : `JAVA: ${javaInfo}`}</MCBadge>
          <MCBadge tone="diamond">klien: prismarine-web-client · versi 1.21.1</MCBadge>
          <MCBadge tone="xp">jembatan: WS→TCP 127.0.0.1:25565 (whitelist)</MCBadge>
          <span className="flex-1" />
          <MCButton tone="gold" onClick={() => setMounted(true)} disabled={mounted}>MASUK DUNIA</MCButton>
          <MCButton tone="green" onClick={() => void toggleFull()}>{full ? "KELUAR FULLSCREEN" : "FULLSCREEN"}</MCButton>
          <MCButton tone="red" onClick={() => setMounted(false)} disabled={!mounted}>TUTUP KLIEN</MCButton>
        </div>
        <p className="mc-body text-[13px] text-white/75 mt-2">
          Di layar judul: <b>PLAY → Join a Server</b> — isian sudah terisi otomatis (127.0.0.1:25565, versi 1.21.1). Tekan <b>Connect</b>.
          Kendali: klik layar untuk pointer-lock, WASD gerak, klik kiri hancurkan blok, klik kanan pasang, T chat, Esc lepas kursor.
          Butuh desktop + mouse; di ponsel klien ini belum nyaman (jujur).
        </p>
      </MCPanel>

      <MCPanel>
        {mounted ? (
          <div
            ref={wrapRef}
            className={full ? "fixed inset-0 z-[100] bg-black" : "w-full h-[70vh] min-h-[420px] border-4 border-black/60 bg-black"}
          >
            <iframe
              src="/mc/index.html"
              title="CIVITAS Minecraft Client"
              className="w-full h-full border-0"
              allow="fullscreen; pointer-lock; gamepad; autoplay"
            />
          </div>
        ) : (
          <div className="w-full h-[70vh] min-h-[420px] border-4 border-black/60 bg-[#191919] flex flex-col items-center justify-center gap-3 text-center px-6">
            <p className="mc-font text-[12px] text-[color:var(--mc-gold)]">KLIEN MINECRAFT BELUM DINYALAKAN</p>
            <p className="mc-body text-[14px] text-white/70 max-w-xl">
              Tekan <b>MASUK DUNIA</b> untuk memuat klien Minecraft asli ke halaman ini.
              Klien berbicara Protokol Minecraft sungguhan ke server Paper melalui jembatan WS→TCP lokal —
              dunia yang tampak adalah dunia server, bukan tiruan.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <MCButton tone="gold" onClick={() => setMounted(true)}>MASUK DUNIA</MCButton>
              <MCButton tone="green" onClick={() => void act("ping_minecraft", {}, "memanggil dunia…")}>PING DUNIA</MCButton>
              <MCButton tone="red" onClick={() => void act("mc_join", {}, "bot CIVITAS masuk dunia…")}>KIRIM BOT</MCButton>
            </div>
          </div>
        )}
      </MCPanel>
    </div>
  );
}
