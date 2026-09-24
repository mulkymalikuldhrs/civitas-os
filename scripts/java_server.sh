#!/bin/bash
# CIVITAS OS — Supervisor server Minecraft JAVA lokal (Paper, all-in-one SLICE 11)
#   java_server.sh {start|stop|status|cmd "<perintah>"}
# Unduhan jar sekali (PaperMC API) + eula auto-accept + FIFO konsol (pola pmmp_server.sh).
set -u
DIR="/home/z/my-project/mc-server/java"
JAR="$DIR/paper.jar"
VER="1.21.1"
PIDFILE="$DIR/server.pid"
RAM="${CIV_JAVA_RAM:-512M}"

case "${1:-}" in
  start)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "ALREADY_RUNNING pid=$(cat "$PIDFILE")"; exit 0
    fi
    mkdir -p "$DIR"
    if [ ! -f "$JAR" ] || [ "$(stat -c%s "$JAR" 2>/dev/null || echo 0)" -lt 10000000 ]; then
      echo "DOWNLOADING paper-$VER ..."
      BUILD=$(curl -s -m 30 "https://api.papermc.io/v2/projects/paper/versions/$VER/builds" | python3 -c "import json,sys; b=json.load(sys.stdin)['builds']; print(b[-1]['build'])" 2>/dev/null) || BUILD=""
      if [ -z "$BUILD" ]; then echo "DOWNLOAD_FAIL: API PaperMC tidak terjangkau"; exit 1; fi
      curl -s -L -m 300 -o "$JAR" "https://api.papermc.io/v2/projects/paper/versions/$VER/builds/$BUILD/downloads/paper-$VER-$BUILD.jar" || { echo "DOWNLOAD_FAIL"; exit 1; }
      echo "DOWNLOADED build=$BUILD size=$(stat -c%s "$JAR")"
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
      java -Xms"$3" -Xmx"$3" -DPaper.IgnoreJavaVersion=true -jar "$2" nogui < console.in >> server.log 2>&1
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
    if pgrep -f "paper.jar" > /dev/null 2>&1; then echo "RUNNING"; else echo "NOT_RUNNING"; fi
    ;;
  cmd)
    if pgrep -f "paper.jar" > /dev/null 2>&1; then
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
