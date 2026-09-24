#!/usr/bin/env python3
"""Normalisasi baris destrukturisasi di index.js + bersihkan akumulasi [h.
Verifikasi memakai charcode (bebas dari korupsi jalur output).
"""
import re

P = "/home/z/my-project/node_modules/prismarine-web-client/index.js"
BR = chr(91)  # '['

with open(P, encoding="utf8") as f:
    src = f.read()

# 1) rapikan run berulang [h[h...host -> [host (di seluruh file, hanya pola ini)
src2 = re.sub(r"(?:\x5bh)+host", BR + "host", src)
n_fixed = len(re.findall(r"(?:\x5bh){2,}host", src))

# 2) pastikan baris destrukturisasi tepat satu & benar
lines = src2.split("\n")
count = 0
for i, l in enumerate(lines):
    if "hostprompt.split" in l:
        lines[i] = '    ' + BR + 'host, port] = hostprompt.split(":")'
        count += 1
src2 = "\n".join(lines)

with open(P, "w", encoding="utf8") as f:
    f.write(src2)

# verifikasi via charcode
with open(P, encoding="utf8") as f:
    chk = f.read().split("\n")
target = next(l for l in chk if "hostprompt.split" in l)
codes = [ord(target[k]) for k in range(4, 12)]
print("stacked_runs_cleaned:", n_fixed)
print("lines_rewritten:", count)
print("L codes[4:12] =", codes, "(expect 91,104,111,115,116,...)")
sw_count = chk and sum(1 for l in chk if "false && 'serviceWorker'" in l)
print("sw_guard_count:", sw_count)
