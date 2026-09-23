#!/bin/bash
# verify_biosfer3.sh — navigasi eksplisit ke BIOSFER + RUANG KENDALI + bukti visual
cd /home/z/my-project
PASS=""; FAIL=""; ok(){ PASS="$PASS| $1"; }; bad(){ FAIL="$FAIL| $1"; }

setsid nohup node node_modules/.bin/next dev -p 3000 >> dev.log 2>&1 < /dev/null & disown
for i in $(seq 1 30); do sleep 4; code=$(curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null); [ "$code" = "200" ] && break; done
[ "$code" = "200" ] && ok "server-up" || bad "server-up ($code)"

agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 6
agent-browser snapshot -i 2>/dev/null > /tmp/s.txt
BREF=$(rg -B2 "BIOSFER" /tmp/s.txt | rg -o "@e[0-9]+" | tail -1)
[ -z "$BREF" ] && BREF=$(rg "BIOSFER" -A2 /tmp/s.txt | rg -o "@e[0-9]+" | head -1)
echo "BREF=$BREF"
agent-browser click $BREF >/dev/null 2>&1; sleep 5
agent-browser snapshot -i 2>/dev/null > /tmp/sb.txt
rg -qi "prt|tradio|denut|creature" /tmp/sb.txt && ok "BIOSFER konten creature ada" || bad "BIOSFER kosong"
# klik creature pertama bila ada (inspektor)
CREF=$(rg -i "prt" -A1 -B1 /tmp/sb.txt | rg -o "@e[0-9]+" | head -1)
[ -n "$CREF" ] && agent-browser click $CREF >/dev/null 2>&1 && ok "klik creature prt ($CREF)" || echo "T-click creature: dilewati"
sleep 8
# PICU DENYUT
DREF=$(rg -i "denut" /tmp/sb.txt | rg -o "@e[0-9]+" | head -1)
echo "DREF=$DREF"
if [ -n "$DREF" ]; then agent-browser click $DREF >/dev/null 2>&1; ok "PICU DENYUT diklik"; else agent-browser snapshot -i 2>/dev/null | rg -i "denut" | head -2; fi
sleep 22
agent-browser screenshot /home/z/my-project/tool-results/biosfer-04-aktif.png >/dev/null 2>&1 && ok "screenshot biosfer aktif"
agent-browser snapshot 2>/dev/null | head -c 1200 > /tmp/sb3.txt
echo "--- konten biosfer ---"; cat /tmp/sb3.txt | head -20

# RUANG KENDALI
agent-browser snapshot -i 2>/dev/null > /tmp/sr.txt
RREF=$(rg -B2 "RUANG" /tmp/sr.txt | rg -o "@e[0-9]+" | tail -1)
[ -z "$RREF" ] && RREF=$(rg -i "kendali" /tmp/sr.txt | rg -o "@e[0-9]+" | head -1)
agent-browser click $RREF >/dev/null 2>&1; sleep 4
agent-browser screenshot /home/z/my-project/tool-results/ruang-01.png >/dev/null 2>&1 && ok "screenshot ruang kendali"
agent-browser close >/dev/null 2>&1 || true

echo ""; echo "================ HASIL ================"
echo "PASS: $PASS" | tr '|' '\n'
echo "FAIL: $FAIL" | tr '|' '\n'
