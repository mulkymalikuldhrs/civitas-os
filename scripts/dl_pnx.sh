#!/bin/bash
# Unduh PowerNukkitX 3.0.5 dengan resume otomatis (tahan koneksi terputus)
cd /home/z/my-project/mc-server || exit 1
URL="https://github.com/PowerNukkitX/PowerNukkitX/releases/download/3.0.5/powernukkitx.jar"
TARGET_SIZE=86100503
for i in $(seq 1 40); do
  sz=$(stat -c%s powernukkitx.jar.part 2>/dev/null || echo 0)
  if [ "$sz" -ge "$TARGET_SIZE" ]; then break; fi
  echo "[try $i] resume dari $sz"
  curl -sL -C - --max-time 120 -o powernukkitx.jar.part "$URL"
  sleep 2
done
sz=$(stat -c%s powernukkitx.jar.part 2>/dev/null || echo 0)
if [ "$sz" -ge "$TARGET_SIZE" ]; then
  mv powernukkitx.jar.part powernukkitx.jar
  echo "DONE $sz" > dl.status
  echo "[ok] unduhan lengkap: $sz byte"
else
  echo "FAILED size=$sz" > dl.status
fi
