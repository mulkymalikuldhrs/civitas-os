#!/bin/bash
# Unduh PocketMine-MP 5 + PHP binary (resilient resume)
set -u
DIR="/home/z/my-project/mc-server/pmmp"
mkdir -p "$DIR"
cd "$DIR" || exit 1

dl() { # dl <url> <out> <loops>
  local url="$1" out="$2" loops="${3:-30}"
  for i in $(seq 1 "$loops"); do
    if [ -f "$out.done" ]; then return 0; fi
    curl -sL -C - --max-time 100 -o "$out" "$url" && touch "$out.done" && return 0
    sleep 1
  done
}

dl "https://github.com/pmmp/PocketMine-MP/releases/download/5.44.3/PocketMine-MP.phar" "PocketMine-MP.phar" &
P1=$!
dl "https://github.com/pmmp/PHP-Binaries/releases/download/php-8.3-latest/PHP-Linux-x86_64-PM5.tar.gz" "php.tar.gz" &
P2=$!
wait $P1 $P2
ls -la
echo "=== unzip php ==="
mkdir -p bin && tar -xzf php.tar.gz -C bin 2>/dev/null && echo PHP_UNPACK_OK
find bin -maxdepth 3 -name "php*" -type f | head -5
echo "DL_ALL_DONE"
