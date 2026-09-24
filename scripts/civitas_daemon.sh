#!/bin/bash
# CIVITAS OS — DAEMON (SLICE 11: self life · self server · self backup · self sync)
#   civitas_daemon.sh {start|stop|status|restart|logs [n]}
# Loop 30 detik: selfLifeTick (watchdog server autoStart + denyut peradaban + backup/sync
# sesuai jadwal config) langsung via bun — TIDAK bergantung pada web app.
# Plus pengawas web app (curl health) yang dilaporkan jujur ke log.
set -u
ROOT="/home/z/my-project"
PIDFILE="$ROOT/.civitas-daemon.pid"
LOGFILE="$ROOT/backups/daemon.log"
INTERVAL="${CIVITAS_DAEMON_INTERVAL:-30}"

is_running() { [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; }

case "${1:-}" in
  start)
    if is_running; then echo "ALREADY_RUNNING pid=$(cat "$PIDFILE")"; exit 0; fi
    mkdir -p "$ROOT/backups"
    (
      while true; do
        ts="$(date '+%F %T')"
        tick="$(cd "$ROOT" && timeout 300 bun scripts/civitas_selflife_tick.ts 2>&1 | tail -1)"
        app="$(curl -s -m 4 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/civos/state 2>/dev/null || echo 000)"
        echo "[$ts] app=$app tick=$tick" >> "$LOGFILE"
        # rotasi log sederhana (2MB)
        if [ "$(stat -c%s "$LOGFILE" 2>/dev/null || echo 0)" -gt 2097152 ]; then
          tail -c 524288 "$LOGFILE" > "$LOGFILE.tmp" && mv "$LOGFILE.tmp" "$LOGFILE"
        fi
        sleep "$INTERVAL"
      done
    ) > /dev/null 2>&1 &
    echo $! > "$PIDFILE"
    echo "DAEMON_STARTED pid=$(cat "$PIDFILE") interval=${INTERVAL}s"
    ;;
  stop)
    if is_running; then
      kill "$(cat "$PIDFILE")" 2>/dev/null || true
      rm -f "$PIDFILE"
      echo "DAEMON_STOPPED"
    else
      rm -f "$PIDFILE"; echo "NOT_RUNNING"
    fi
    ;;
  status)
    if is_running; then
      echo "RUNNING pid=$(cat "$PIDFILE")"
      echo "last: $(tail -1 "$LOGFILE" 2>/dev/null || echo '-')"
    else
      echo "NOT_RUNNING"
    fi
    ;;
  restart)
    "$0" stop; sleep 1; "$0" start
    ;;
  logs)
    tail -"${2:-20}" "$LOGFILE" 2>/dev/null || echo "log kosong"
    ;;
  *)
    echo "usage: civitas_daemon.sh {start|stop|status|restart|logs [n]}"; exit 1
    ;;
esac
