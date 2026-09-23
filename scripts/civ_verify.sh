#!/bin/bash
# civ_verify.sh — verifikasi monolitik CIVITAS OS (server + tes dalam 1 panggilan).
cd /home/z/my-project

UP=$(curl -s -o /dev/null -w "%{http_code}" -m 3 http://localhost:3000/api/health 2>/dev/null || true)
UP2=$(curl -s -o /dev/null -w "%{http_code}" -m 3 http://localhost:3000/api/civos/state 2>/dev/null || true)

if [ "$UP" != "200" ] && [ "$UP2" != "200" ]; then
  echo "[civ] server mati — menyalakan…"
  pkill -f "next dev" 2>/dev/null; sleep 2
  nohup bash .zscripts/dev.sh > /dev/null 2>&1 &
  for i in $(seq 1 60); do
    code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 http://localhost:3000/api/civos/state 2>/dev/null)
    [ "$code" = "200" ] && echo "[civ] server UP (~$((i*3))s)" && break
    sleep 3
  done
fi

echo "== T1 STATE =="
curl -s -m 30 http://localhost:3000/api/civos/state | python3 -c "
import json,sys
d=json.load(sys.stdin); s=d['state']
print('seed:',s['seed']['detail'])
print('orgs:',[(o['code'],o['lifecycle']) for o in s['orgs']])
print('agents:',s['counts']['agents'],'events:',s['counts']['events'],'txns:',s['counts']['txns'],'tasks:',s['counts']['tasks'])
m=s['metrics']
print('treasury:',m['treasury'],'supply:',m['moneySupply'],'intTrade:',m['internalTradeVolume'],'ext:',m['externalRevenue'])
print('alerts:',m['alerts'])
print('lastTick:',s['lastTick'])
"

echo "== T2 DENYUT x5 =="
for i in 1 2 3 4 5; do
  curl -s -m 90 -X POST http://localhost:3000/api/civos/heartbeat -H 'Content-Type: application/json' -d '{}' | python3 -c "
import json,sys
d=json.load(sys.stdin); s=d.get('summary',{})
print(f\"#{s.get('tick')} {s.get('target')} {s.get('kind')} [{s.get('mode','-')}:{s.get('model','-')}] {str(s.get('summary'))[:84]} => {str(s.get('executed'))[:66]}\")
"
done

echo "== T3 STATE PASCA-DENYUT =="
curl -s -m 30 http://localhost:3000/api/civos/state | python3 -c "
import json,sys
d=json.load(sys.stdin); s=d['state']
print('companies:',[(o['code'],o['lifecycle']) for o in s['orgs'] if o['kind']=='COMPANY'])
print('txns:',s['counts']['txns'])
m=s['metrics']
print('treasury:',m['treasury'],'intTrade:',m['internalTradeVolume'],'tax:',m['taxCollected'])
print('ledger terakhir:')
for r in s['ledger'][:10]: print('  ',r['txType'],r['amount'],'|',r['purpose'][:64],'|',('EXT' if r['isExternal'] else 'INT'))
print('proposals:')
for p in s['proposals'][:8]: print('  ',p['kind'],p['orgCode'],p['status'],'skor',p['policyCheck'].get('skor'),'|',p['reason'][:50])
print('tasks router:')
for t in s['tasks'][:6]: print('  ',t['agentCode'],t['orgCode'],t['status'],t['route'].get('mode'),t['route'].get('model'))
"

echo "== T4 MINECRAFT PING (force) =="
curl -s -m 30 "http://localhost:3000/api/civos/minecraft?force=1" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('server:',d['server'],'online:',d['status']['online'],'| err:',d['status'].get('error'))
print('entities:',len(d['entities']),'| contoh:',d['entities'][0]['mcName'],'->',d['entities'][0]['civCode'] if d['entities'] else '-')
"

echo "== T5 AKSI: honesty gate revenue eksternal =="
curl -s -m 30 -X POST http://localhost:3000/api/civos/action -H 'Content-Type: application/json' -d '{"action":"declare_external_customer"}' -w "\nHTTP:%{http_code}\n" | head -c 400

echo "== SELESAI =="
