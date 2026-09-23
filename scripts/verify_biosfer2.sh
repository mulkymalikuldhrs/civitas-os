#!/bin/bash
# verify_biosfer2.sh — re-cek T3 + T8 + bukti visual (mobile + ruang kendali)
cd /home/z/my-project
PASS=""; FAIL=""
ok(){ PASS="$PASS| $1"; }; bad(){ FAIL="$FAIL| $1"; }

setsid nohup node node_modules/.bin/next dev -p 3000 >> dev.log 2>&1 < /dev/null & disown
for i in $(seq 1 30); do sleep 4; code=$(curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null); [ "$code" = "200" ] && break; done
[ "$code" = "200" ] && ok "server-up" || bad "server-up ($code)"

# T3-fix: creature.list dengan parse benar (content = array blok)
T3=$(curl -s -m 30 http://localhost:3000/api/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"creature.list","arguments":{}}}' | python3 -c "
import json,sys
d=json.load(sys.stdin)
blocks=d['result']['content']
txt=''.join(b.get('text','') for b in blocks if isinstance(b,dict))
data=json.loads(txt) if txt.strip().startswith(('{','[')) else txt
if isinstance(data,dict): data=data.get('creatures',[])
print(','.join(x.get('id','?') for x in data))" 2>/tmp/t3err)
echo "$T3" | rg -q "prt" && ok "T3 creature.list ($T3)" || bad "T3 creature.list ($T3) err:$(head -c 120 /tmp/t3err)"

# T8: cek apakah 2 error itu entri LAMA (sebelum server baru) — hitung hanya setelah baris 'Ready in' terakhir
READY_LINE=$(strings dev.log | rg -n "Ready in" | tail -1 | cut -d: -f1)
TAIL_ERR=$(tail -n +$((READY_LINE)) dev.log | strings | rg -c "Module not found|Parsing ecmascript" 2>/dev/null)
[ -z "$TAIL_ERR" ] || [ "$TAIL_ERR" = "0" ] && ok "T8 log-server-aktif bersih" || bad "T8 masih $TAIL_ERR error pada instance aktif"

# T9: agent-browser — desktop BIOSFER + klik creature (inspektor) + PICU DENYUT
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 6
agent-browser snapshot -i 2>/dev/null > /tmp/snap1.txt
NAVREF=$(rg -o "@e[0-9]+" /tmp/snap1.txt | head -1)
agent-browser click $NAVREF >/dev/null 2>&1; sleep 4
agent-browser snapshot -i 2>/dev/null > /tmp/snap2.txt
rg -qi "denut" /tmp/snap2.txt && ok "T9a tombol PICU DENYUT ada" || bad "T9a PICU DENYUT tidak ketemu"
DREF=$(rg "DENYUT|Denyut" -n /tmp/snap2.txt | rg -o "@e[0-9]+" | head -1)
[ -n "$DREF" ] && agent-browser click $DREF >/dev/null 2>&1 && ok "T9b PICU DENYUT diklik ($DREF)" || bad "T9b tombol tidak diklik"
sleep 20
agent-browser snapshot 2>/dev/null > /tmp/snap3.txt
rg -qi "menalar|refleks|SADAR|keputusan" /tmp/snap3.txt && ok "T9c keputusan tampil di biosfer" || bad "T9c keputusan belum tampil"
agent-browser screenshot /home/z/my-project/tool-results/biosfer-02-desktop.png >/dev/null 2>&1 && ok "T9d screenshot desktop"

# T10: mobile 390px
agent-browser resize 390 844 >/dev/null 2>&1 || true
sleep 2
agent-browser screenshot /home/z/my-project/tool-results/biosfer-03-mobile.png >/dev/null 2>&1 && ok "T10 mobile screenshot"
agent-browser close >/dev/null 2>&1 || true

echo ""; echo "================ HASIL ================"
echo "PASS: $PASS" | tr '|' '\n'
echo "FAIL: $FAIL" | tr '|' '\n'
