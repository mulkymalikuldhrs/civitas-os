#!/bin/bash
# civ_e2e.sh — E2E browser monolitik v2: klik via role button + name aksesibel.
cd /home/z/my-project
mkdir -p tool-results

code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 http://localhost:3000/api/civos/state 2>/dev/null)
if [ "$code" != "200" ]; then
  pkill -f "next dev" 2>/dev/null; sleep 2
  nohup bash .zscripts/dev.sh > /dev/null 2>&1 &
  for i in $(seq 1 60); do
    c=$(curl -s -o /dev/null -w "%{http_code}" -m 5 http://localhost:3000/api/civos/state 2>/dev/null)
    [ "$c" = "200" ] && break; sleep 3
  done
fi
echo "[e2e] server OK"

ab() { agent-browser "$@" 2>&1; }

ab set viewport 1440 900
ab open http://localhost:3000
ab wait --load networkidle
sleep 2

# --- 09 PERADABAN via role+name ---
ab find role button click --name "09 PERADABAN"
sleep 3
ab wait --text "AUTONOMOUS CIVILIZATION OPERATING SYSTEM"
ab screenshot tool-results/civ-01-peradaban.png
echo "[e2e] 09 PERADABAN dimuat (header unik cocok)"

# --- Sub-tab ---
ab find role button click --name "PEMERINTAH";  sleep 1.5; ab screenshot tool-results/civ-02-pemerintah.png
ab find role button click --name "PERUSAHAAN";  sleep 1.5; ab screenshot tool-results/civ-03-perusahaan.png
ab find role button click --name "EKONOMI";     sleep 1.5; ab screenshot tool-results/civ-04-ekonomi.png
ab find role button click --name "CONTROL PLANE"; sleep 1.5; ab screenshot tool-results/civ-05-control.png
ab find role button click --name "EVENT";       sleep 1.5; ab screenshot tool-results/civ-06-event.png
echo "[e2e] 6 sub-tab diklik"

# --- PETA + denyut manual ---
ab find role button click --name "PETA"; sleep 1
ab find role button click --name "♥ DENYUT SEKARANG"
sleep 10
ab screenshot tool-results/civ-07-denyut.png
echo "[e2e] denyut dipicu dari browser"

# --- 10 MINECRAFT ---
ab find role button click --name "10 MINECRAFT"
sleep 3
ab find role button click --name "PING ULANG"
sleep 6
ab screenshot tool-results/civ-08-minecraft.png
echo "[e2e] 10 MINECRAFT + ping manual"

echo "--- verifikasi teks kunci ---"
ab snapshot -c | grep -E "AUTONOMOUS CIVILIZATION|REVENUE EKSTERNAL|SERVER OFFLINE|SERVER ONLINE|Kas Bangsa|EVENT BUS" | head -8

echo "--- error konsol halaman ---"
ab errors | head -8
ab close
echo "[e2e] SELESAI"
