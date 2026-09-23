#!/bin/bash
# verify_biosfer.sh — verifikasi penuh BIOSFER v1.1 dalam SATU sesi proses
cd /home/z/my-project
PASS=""; FAIL=""

ok(){ PASS="$PASS| $1"; }
bad(){ FAIL="$FAIL| $1"; }

# 0. pastikan server hidup
setsid nohup node node_modules/.bin/next dev -p 3000 >> dev.log 2>&1 < /dev/null & disown
for i in $(seq 1 30); do sleep 4; code=$(curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null); [ "$code" = "200" ] && break; done
[ "$code" = "200" ] && ok "server-up (200)" || { bad "server-up ($code)"; goto_report 2>/dev/null; }

# T2: tools/list
T2=$(curl -s -m 30 http://localhost:3000/api/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | python3 -c "import json,sys; d=json.load(sys.stdin); print(','.join(t['name'] for t in d['result']['tools']))" 2>/dev/null)
echo "$T2" | rg -q "creature.list" && ok "T2 tools/list ($T2)" || bad "T2 tools/list ($T2)"

# T3: creature.list
T3=$(curl -s -m 30 http://localhost:3000/api/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"creature.list","arguments":{}}}' | python3 -c "import json,sys; d=json.load(sys.stdin); c=d['result']['content']; data=json.loads(c) if isinstance(c,str) else c; ids=[x.get('id') for x in (data.get('creatures') if isinstance(data,dict) else data)]; print(','.join(ids))" 2>/dev/null)
echo "$T3" | rg -q "prt" && ok "T3 creature.list ($T3)" || bad "T3 creature.list ($T3)"

# T4: creature.dispatch Tradio (LLM)
T4=$(curl -s -m 90 http://localhost:3000/api/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"creature.dispatch","arguments":{"creature":{"id":"tradio","role":"trader","energy":72,"wealth":40,"skills":["quant-scoring"],"status":"aktif"},"context":"sinyal terakhir HOLD, volatilitas naik"}}}' | head -c 260)
echo "$T4" | rg -qi "decision|ok" && ok "T4 dispatch: $(echo $T4 | head -c 150)" || bad "T4 dispatch: $T4"

# T5: prt chat
T5=$(curl -s -m 90 http://localhost:3000/api/organism/chat -H 'Content-Type: application/json' -d '{"message":"lapor status biosfer","context":{"tier":"PRO"}}' | head -c 200)
echo "$T5" | rg -qi '"ok":true' && ok "T5 prt chat" || bad "T5 prt chat: $T5"

# T6: agent-browser — BIOSFER
agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 6
SNAP=$(agent-browser snapshot -i 2>/dev/null | head -c 3000)
echo "$SNAP" | rg -qi "BIOSFER" && ok "T6a nav BIOSFER terlihat" || bad "T6a nav BIOSFER tidak terlihat"
REF=$(echo "$SNAP" | rg -o "@e[0-9]+" | head -1)
agent-browser click $REF >/dev/null 2>&1 || true; sleep 3
SNAP2=$(agent-browser snapshot -i 2>/dev/null | head -c 4000)
echo "$SNAP2" | rg -qi "BIOSFER|prt|Tradio" && ok "T6b biosfer konten" || bad "T6b biosfer konten"
agent-browser screenshot /home/z/my-project/tool-results/biosfer-01.png >/dev/null 2>&1 && ok "T6c screenshot" || bad "T6c screenshot"

# T7: lint
bun run lint >/tmp/lint.out 2>&1 && ok "T7 lint bersih" || { bad "T7 lint"; tail -5 /tmp/lint.out; }

# T8: dev.log error scan (ekor)
E=$(tail -c 30000 dev.log | strings | rg -c "Module not found|Parsing ecmascript" 2>/dev/null)
[ -z "$E" ] || [ "$E" = "0" ] && ok "T8 dev.log bersih (ekor)" || bad "T8 dev.log masih ada $E error ekor"

echo ""
echo "================ HASIL ================"
echo "PASS: $PASS" | tr '|' '\n'
echo "FAIL: $FAIL" | tr '|' '\n'
