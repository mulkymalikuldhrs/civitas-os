"use client";

// useOrganismEngine — hook pemasang denyut otomatis BIOSFER (11_AUTONOMOUS_ORGANISM §4).
// Dipasang SEKALI di AppShell: interval ±45 dtk menjalankan SATU denyut creature
// saat mandat L3+ terbuka; interval dibersihkan saat unmount; ref-guard membuat
// React StrictMode (double-mount) tetap aman dari denyut ganda.
//
// v1.2.2 (denyut 24/7, tiga lapis — semua LOKAL, zero-storage):
//   1. Interval halaman (±45 dtk) — lapisan dasar.
//   2. Catch-up visibilitychange — pulang ke tab → denyut segera bila basi
//      (browser men-throttle interval tab tersembunyi; denyut tak bolong lama).
//   3. Pesan Service Worker (sw-korteks periodicsync/sync) — denyut infrastruktur
//      saat halaman dibuka kembali setelah lama; SW membangunkan klien → denyut penuh.

import { useEffect, useRef } from "react";
import { useFlybrain } from "@/lib/flybrain/store";
import { pulseOnce, PULSE_INTERVAL_MS, lastBiosferPulseAt } from "@/lib/flybrain/organism/engine";
import { shouldRun } from "@/lib/flybrain/organism/organs/scheduler";

export function useOrganismEngine(): void {
  const autonomyLevel = useFlybrain((s) => s.autonomyLevel);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (autonomyLevel >= 3) {
      // Ref guard: jangan buat interval kedua bila sudah ada (aman StrictMode).
      if (intervalRef.current === null) {
        intervalRef.current = setInterval(() => {
          void pulseOnce("auto");
        }, PULSE_INTERVAL_MS);
      }
    } else if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autonomyLevel]);

  useEffect(() => {
    if (autonomyLevel < 3) return;

    // Lapisan 2: catch-up — tab tersembunyi membuat interval di-throttle browser;
    // saat tab kembali terlihat, denyut segera dikejar bila jeda terakhir sudah basi.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (shouldRun(lastBiosferPulseAt())) void pulseOnce("auto");
    };
    document.addEventListener("visibilitychange", onVisible);

    // Lapisan 3: SW → klien. sw-korteks.js periodicsync/sync mem-broadcast
    // {type:"korteks-pulse"}; klien mengejar denyut bila memang sudah basi.
    let swHandler: ((e: MessageEvent) => void) | null = (e: MessageEvent) => {
      if (e?.data?.type === "korteks-pulse" && shouldRun(lastBiosferPulseAt())) void pulseOnce("auto");
    };
    navigator.serviceWorker?.addEventListener("message", swHandler);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (swHandler) {
        navigator.serviceWorker?.removeEventListener("message", swHandler);
        swHandler = null;
      }
    };
  }, [autonomyLevel]);
}
