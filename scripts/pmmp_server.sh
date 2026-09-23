#!/bin/bash
# CIVITAS OS — Supervisor server Minecraft lokal (PocketMine-MP, Bedrock nyata)
#   pmmp_server.sh {start|stop|status|cmd "<perintah>"}
set -u
DIR="/home/z/my-project/mc-server/pmmp"
cd "$DIR" || exit 1
PHP="$DIR/bin/bin/php7/bin/php"
PHAR="$DIR/PocketMine-MP.phar"
PIDFILE="$DIR/server.pid"

case "${1:-}" in
  start)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "ALREADY_RUNNING pid=$(cat "$PIDFILE")"; exit 0
    fi
    [ -p "$DIR/console.in" ] || mkfifo "$DIR/console.in"
    setsid bash -c '
      cd "$1"
      exec 9<>console.in   # ujung tulis FIFO tetap terbuka — stdin php tidak pernah EOF
      exec 2>/dev/null 3>&2
      "$2" "$3" --no-wizard --disable-ansi < console.in >> server.log 2>&1
    ' _ "$DIR" "$PHP" "$PHAR" > /dev/null 2>&1 < /dev/null &
    echo $! > "$PIDFILE"
    echo "STARTING pid=$(cat "$PIDFILE")"
    ;;
  stop)
    if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "stop" > "$DIR/console.in" 2>/dev/null
      sleep 5
      kill -- -"$(cat "$PIDFILE")" 2>/dev/null || true
      rm -f "$PIDFILE"
      echo "STOPPED"
    else
      echo "NOT_RUNNING"; rm -f "$PIDFILE"
    fi
    ;;
  status)
    if pgrep -f "PocketMine-MP.phar" > /dev/null 2>&1; then echo "RUNNING"; else echo "NOT_RUNNING"; fi
    ;;
  cmd)
    if pgrep -f "PocketMine-MP.phar" > /dev/null 2>&1; then
      echo "${2:-help}" > "$DIR/console.in" 2>/dev/null
      echo "SENT: ${2:-}"
    else
      echo "SERVER_NOT_RUNNING"
    fi
    ;;
  *)
    echo "usage: pmmp_server.sh {start|stop|status|cmd <command>}"; exit 1
    ;;
esac
