#!/bin/bash
# CIVITAS OS — Supervisor server Minecraft JAVA lokal (Paper, all-in-one SLICE 11)
#   java_server.sh {start|stop|status|cmd "<perintah>"}
# Unduhan jar sekali (PaperMC API) + eula auto-accept + FIFO konsol (pola pmmp_server.sh).
set -u
DIR="/home/z/my-project/mc-server/java"
JAR="$DIR/paper.jar"
VER="1.21.1"
PIDFILE="$DIR/server.pid"
RAM="${CIV_JAVA_RAM:-512M}" # 2026-09-25: 384M → 512M — crash report: OutOfMemoryError: Metaspace @128m (Paper butuh metaspace lebih besar); total tetap aman utk RAM 4GB

case "${1:-}" in
  start)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "ALREADY_RUNNING pid=$(cat "$PIDFILE")"; exit 0
    fi
    mkdir -p "$DIR"
    if [ ! -f "$JAR" ] || [ "$(stat -c%s "$JAR" 2>/dev/null || echo 0)" -lt 10000000 ]; then
      echo "DOWNLOADING server jar ($VER) ..."
      DL=""; SRC=""
      # Sumber 1: PaperMC
      BUILD=$(curl -s -m 30 "https://api.papermc.io/v2/projects/paper/versions/$VER/builds" | python3 -c "import json,sys; b=json.load(sys.stdin)['builds']; print(b[-1]['build'])" 2>/dev/null) || BUILD=""
      if [ -n "$BUILD" ]; then DL="https://api.papermc.io/v2/projects/paper/versions/$VER/builds/$BUILD/downloads/paper-$VER-$BUILD.jar"; SRC="paper"; fi
      # Sumber 2: Purpur (fork Paper)
      if [ -z "$DL" ]; then
        PB=$(curl -s -m 30 "https://api.purpurmc.org/v2/purpur/$VER" | python3 -c "import json,sys; print(json.load(sys.stdin)['builds']['latest'])" 2>/dev/null) || PB=""
        if [ -n "$PB" ]; then DL="https://api.purpurmc.org/v2/purpur/$VER/$PB/download"; SRC="purpur-$PB"; fi
      fi
      # Sumber 3: vanilla resmi Mojang
      if [ -z "$DL" ]; then
        VURL=$(curl -s -m 30 "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json" | python3 -c "import json,sys; d=json.load(sys.stdin); print([v['url'] for v in d['versions'] if v['id']=='$VER'][0])" 2>/dev/null) || VURL=""
        if [ -n "$VURL" ]; then DL=$(curl -s -m 30 "$VURL" | python3 -c "import json,sys; print(json.load(sys.stdin)['downloads']['server']['url'])" 2>/dev/null) || DL=""; SRC="vanilla"; fi
      fi
      if [ -z "$DL" ]; then echo "DOWNLOAD_FAIL: tidak ada sumber terjangkau (paper/purpur/mojang)"; exit 1; fi
      echo "source=$SRC"
      curl -s -L -m 600 -o "$JAR" "$DL" || { echo "DOWNLOAD_FAIL"; exit 1; }
      [ "$(stat -c%s "$JAR" 2>/dev/null || echo 0)" -gt 10000000 ] || { echo "DOWNLOAD_FAIL: file terlalu kecil"; exit 1; }
      echo "DOWNLOADED $SRC size=$(stat -c%s "$JAR")"
    fi
    [ -f "$DIR/eula.txt" ] || echo "eula=true" > "$DIR/eula.txt"
    if [ ! -f "$DIR/server.properties" ]; then
      printf "online-mode=false\nmotd=CIVITAS OS — Java Realm\nview-distance=4\nspawn-protection=0\nmax-players=10\nenable-command-block=true\n" > "$DIR/server.properties"
    fi
    [ -p "$DIR/console.in" ] || mkfifo "$DIR/console.in"
    setsid bash -c '
      cd "$1"
      exec 9<>console.in
      exec 2>/dev/null 3>&2
      java -Xms"$3" -Xmx"$3" -XX:MaxMetaspaceSize=256m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -DPaper.IgnoreJavaVersion=true -jar "$2" nogui < console.in >> server.log 2>&1
    ' _ "$DIR" "$JAR" "$RAM" > /dev/null 2>&1 < /dev/null &
    echo $! > "$PIDFILE"
    echo "STARTING pid=$(cat "$PIDFILE") ram=$RAM"
    ;;
  stop)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "stop" > "$DIR/console.in" 2>/dev/null
      sleep 8
      kill -- -"$(cat "$PIDFILE")" 2>/dev/null || true
      rm -f "$PIDFILE"
      echo "STOPPED"
    else
      echo "NOT_RUNNING"; rm -f "$PIDFILE"
    fi
    ;;
  status)
    if pgrep -f "$DIR/paper.jar" > /dev/null 2>&1 || pgrep -f "mc-server/java" > /dev/null 2>&1; then echo "RUNNING"; else echo "NOT_RUNNING"; fi
    ;;
  cmd)
    if pgrep -f "mc-server/java" > /dev/null 2>&1; then
      echo "${2:-help}" > "$DIR/console.in" 2>/dev/null
      echo "SENT: ${2:-}"
    else
      echo "SERVER_NOT_RUNNING"
    fi
    ;;
  *)
    echo "usage: java_server.sh {start|stop|status|cmd <command>}"; exit 1
    ;;
esac
