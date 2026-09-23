#!/bin/bash
# civ_verify2.sh — verifikasi final monolitik: supabase + kota2 + kuant + settle + pajak otomatis + denyut.
cd /home/z/my-project

# Selalu mulai server BARU dalam panggilan ini (sandbox membunuh proses lama antar-panggilan)
pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null; fuser -k 3000/tcp 2>/dev/null; sleep 3
rm -rf .next
nohup bash .zscripts/dev.sh > /dev/null 2>&1 &
for i in $(seq 1 100); do
  c=$(curl -s -o /dev/null -w "%{http_code}" -m 5 http://localhost:3000/api/civos/state 2>/dev/null)
  [ "$c" = "200" ] && echo "[v2] server OK (~$((i*3))s)" && break; sleep 3
done

echo "== A1 SINKRON SUPABASE (POST /api/civos/sync) =="
curl -s -m 40 -X POST http://localhost:3000/api/civos/sync | head -c 300; echo
echo "== A2 STATUS AWAN =="
curl -s -m 30 http://localhost:3000/api/civos/sync | head -c 400; echo

echo "== B1 KOTA KEDUA =="
curl -s -m 30 -X POST http://localhost:3000/api/civos/action -H 'Content-Type: application/json' -d '{"action":"create_city","params":{"name":"Bandar Langit","specialization":"Pelabuhan & perdagangan"}}' | head -c 220; echo
echo "== B2 KANTOR KUANT =="
curl -s -m 30 -X POST http://localhost:3000/api/civos/action -H 'Content-Type: application/json' -d '{"action":"create_quant_office"}' | head -c 220; echo

echo "== C1 SETTLE SANDBOX (rail uji, BUKAN uang riil) =="
curl -s -m 30 -X POST http://localhost:3000/api/civos/action -H 'Content-Type: application/json' -d '{"action":"settle_external","params":{"orgCode":"COMP-001","counterparty":"PT Maju Jaya","amount":25000,"reference":"TEST-001","env":"sandbox"}}' | head -c 300; echo
echo "== C2 SETTLE LIVE TANPA GATE (harus DITOLAK) =="
curl -s -m 30 -X POST http://localhost:3000/api/civos/action -H 'Content-Type: application/json' -d '{"action":"settle_external","params":{"counterparty":"X","amount":1000,"reference":"LIVE-1","env":"live"}}' -w "\nHTTP:%{http_code}\n" | head -c 320

echo "== D DENYUT x12 (menuju pajak otomatis + kuant + registrasi) =="
for i in $(seq 1 12); do
  curl -s -m 90 -X POST http://localhost:3000/api/civos/heartbeat -H 'Content-Type: application/json' -d '{}' | python3 -c "import json,sys; d=json.load(sys.stdin); s=d.get('summary',{}); print(f\"#{s.get('tick')} {s.get('target')} {s.get('kind','')} [{s.get('mode','-')}:{s.get('model','-')}] {str(s.get('summary'))[:86]}\")" 2>/dev/null || echo "($i) no-resp"
done

echo "== E STATE FINAL =="
curl -s -m 30 http://localhost:3000/api/civos/state | python3 -c "
import json,sys
d=json.load(sys.stdin); s=d['state']; m=s['metrics']
print('orgs:',[(o['code'],o['lifecycle']) for o in s['orgs']])
print('treasury:',m['treasury'],'| govCash:',m['govCash'],'| taxCollected:',m['taxCollected'])
print('extRevenue total:',m['externalRevenue'],'| REAL:',m['externalRevenueReal'],'| SANDBOX:',m['externalRevenueSandbox'])
print('intTrade:',m['internalTradeVolume'],'| events:',s['counts']['events'],'| txns:',s['counts']['txns'])
print('alerts:',m['alerts'])
"
echo "== F SINKRON ULANG SUPABASE (bawa semua event baru) =="
curl -s -m 40 -X POST http://localhost:3000/api/civos/sync | head -c 300; echo
curl -s -m 30 http://localhost:3000/api/civos/sync | python3 -c "import json,sys; d=json.load(sys.stdin); print('cloud sync_log:', d['cloud']['rows'][:3])"

echo "== G MINECRAFT (ping force) =="
curl -s -m 30 "http://localhost:3000/api/civos/minecraft?force=1" | python3 -c "import json,sys; d=json.load(sys.stdin); print('online:',d['status']['online'],'| err:',str(d['status'].get('error'))[:80],'| entities:',len(d['entities']))"
echo "[v2] SELESAI"
