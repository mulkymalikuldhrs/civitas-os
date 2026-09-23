#!/bin/bash
# CIVITAS OS — Supervisor server Minecraft lokal (PowerNukkitX, Bedrock nyata)
# Pemakaian:
#   mc_server.sh start   -> nyalakan server (FIFO konsol + log)
#   mc_server.sh stop    -> matikan server lewat konsol (stop)
#   mc_server.sh status  -> pgrep + ping RakNet
#   mc_server.sh cmd "<perintah>"  -> kirim perintah ke konsol server
set -u
DIR="/home/z/my-project/mc-server"
cd "$DIR" || exit 1
JAR="powernukkitx.jar"
PIDFILE="$DIR/server.pid"

case "${1:-}" in
  start)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "ALREADY_RUNNING pid=$(cat "$PIDFILE")"; exit 0
    fi
    rm -f "$DIR/server.lock"
    [ -p "$DIR/console.in" ] || mkfifo "$DIR/console.in"
    setsid bash -c '
      cd "$1"
      # pegang ujung tulis FIFO agar stdin java tidak pernah EOF (anti prompt-spam)
      exec 9<>console.in
      java -Xms512M -Xmx1100M -XX:+UseG1GC -jar powernukkitx.jar --nogui < console.in >> server.log 2>&1
    ' _ "$DIR" > /dev/null 2>&1 < /dev/null &
    echo $! > "$PIDFILE"
    echo "STARTING pid=$(cat "$PIDFILE") (tunggu 15-30 dtk, cek: status)"
    ;;
  stop)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "stop" > "$DIR/console.in" 2>/dev/null
      sleep 6
      kill -- -"$(cat "$PIDFILE")" 2>/dev/null || true
      rm -f "$PIDFILE"
      echo "STOPPED"
    else
      echo "NOT_RUNNING"; rm -f "$PIDFILE"
    fi
    ;;
  status)
    if pgrep -f "powernukkitx.jar" > /dev/null 2>&1; then
      echo "RUNNING"
    else
      echo "NOT_RUNNING"
    fi
    ;;
  cmd)
    if pgrep -f "powernukkitx.jar" > /dev/null 2>&1; then
      echo "${2:-help}" > "$DIR/console.in" 2>/dev/null
      echo "SENT: ${2:-}"
    else
      echo "SERVER_NOT_RUNNING"
    fi
    ;;
  *)
    echo "usage: mc_server.sh {start|stop|status|cmd <command>}"; exit 1
    ;;
esac
