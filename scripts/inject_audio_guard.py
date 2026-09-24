#!/usr/bin/env python3
"""Sisipkan ulang audio guard ke bundle public/mc/index.js (idempoten).
Guard lama dibuang dulu bila ada, lalu guard terbaru disisipkan di paling depan.
"""
import re

GUARD = "/home/z/my-project/scripts/mc_audio_guard.js"
BUNDLE = "/home/z/my-project/public/mc/index.js"

with open(GUARD, encoding="utf8") as f:
    guard = f.read()
with open(BUNDLE, encoding="utf8") as f:
    src = f.read()

marker_end = "})();"
if src.startswith("// CIVITAS OS"):
    # buang guard lama: sampai pola akhir guard pertama
    idx = src.find(marker_end)
    if idx != -1:
        src = src[idx + len(marker_end):]
        src = src.lstrip("\n")

new_src = guard + "\n" + src
with open(BUNDLE, "w", encoding="utf8") as f:
    f.write(new_src)
print("guard v2 disisipkan; bundle", f"{len(new_src)/1e6:.1f} MB", "| diawali guard:", new_src.startswith("// CIVITAS OS"))
