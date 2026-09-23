#!/bin/bash
# verify_biosfer4.sh — klik ref persis dari baris nav "07 BIOSFER"
cd /home/z/my-project
setsid nohup node node_modules/.bin/next dev -p 3000 >> dev.log 2>&1 < /dev/null & disown
for i in $(seq 1 30); do sleep 4; code=$(curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null); [ "$code" = "200" ] && break; done
echo "server: $code"

agent-browser open http://localhost:3000 >/dev/null 2>&1; sleep 6
agent-browser snapshot -i 2>/dev/null > /tmp/sn.txt
# baris persis: button "07 BIOSFER" [ref=eXX]
BREF=$(rg 'BIOSFER' /tmp/sn.txt | rg -o 'ref=e[0-9]+' | head -1 | sed 's/ref=/@/')
echo "BIOSFER ref: $BREF"
agent-browser click "$BREF" >/dev/null 2>&1
sleep 5
agent-browser screenshot /home/z/my-project/tool-results/biosfer-05.png >/dev/null 2>&1
agent-browser snapshot 2>/dev/null | head -c 2500 > /tmp/biosfer-content.txt

# klik creature prt (bila tampak sebagai button)
PREF=$(rg 'prt' /tmp/biosfer-content.txt | rg -o 'ref=e[0-9]+' | head -1 | sed 's/ref=/@/')
echo "prt ref: $PREF"
[ -n "$PREF" ] && agent-browser click "$PREF" >/dev/null 2>&1 && sleep 3
agent-browser screenshot /home/z/my-project/tool-results/biosfer-06-inspektor.png >/dev/null 2>&1

# PICU DENYUT bila ada
DREF=$(agent-browser snapshot -i 2>/dev/null | rg -i 'denut' | rg -o 'ref=e[0-9]+' | head -1 | sed 's/ref=/@/')
echo "DENYUT ref: $DREF"
[ -n "$DREF" ] && agent-browser click "$DREF" >/dev/null 2>&1 && sleep 25 && agent-browser screenshot /home/z/my-project/tool-results/biosfer-07-pulse.png >/dev/null 2>&1

# RUANG KENDALI
RREF=$(agent-browser snapshot -i 2>/dev/null | rg 'RUANG' | rg -o 'ref=e[0-9]+' | head -1 | sed 's/ref=/@/')
echo "RUANG ref: $RREF"
[ -n "$RREF" ] && agent-browser click "$RREF" >/dev/null 2>&1 && sleep 4 && agent-browser screenshot /home/z/my-project/tool-results/ruang-02.png >/dev/null 2>&1
agent-browser close >/dev/null 2>&1
echo "done"
