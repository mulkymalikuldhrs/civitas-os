#!/usr/bin/env python3
"""Slim minecraft-data/data.js untuk build browser (CIVITAS OS v1.5).
Menyimpan HANYA versi pc yang dipakai klien web (1.21.1 utama, 1.20.4 cadangan),
membackup original ke data.js.orig. Idempoten: selalu bekerja dari .orig.
"""
import os
import re

D = "/home/z/my-project/node_modules/minecraft-data/data.js"
ORIG = D + ".orig"
KEEP = ["1.21.1", "1.20.4"]

if not os.path.exists(ORIG):
    with open(D, encoding="utf8") as f:
        src = f.read()
    with open(ORIG, "w", encoding="utf8") as f:
        f.write(src)
    print("original dibackup -> data.js.orig")
else:
    with open(ORIG, encoding="utf8") as f:
        src = f.read()

# potong blok per versi pc: '    <versi>: {' ... sampai '    },' atau '    }'
lines = src.split("\n")
out = []
in_pc = False
keep_this = False
depth_buf: list[str] = []
kept_count = 0
dropped = 0
for ln in lines:
    m_pc = re.match(r"^  'pc': \{$", ln)
    if m_pc:
        in_pc = True
        out.append(ln)
        continue
    if in_pc:
        m_ver = re.match(r"^    '([^']+)': \{$", ln)
        if m_ver:
            keep_this = m_ver.group(1) in KEEP
            if keep_this:
                kept_count += 1
            else:
                dropped += 1
            out.append(ln)
            continue
        if re.match(r"^  \},$", ln) or re.match(r"^  \}$", ln):
            in_pc = False
            keep_this = False
            out.append(ln)
            continue
        # di dalam blok versi: baris isi hanya dipertahankan bila versi disimpan
        if keep_this:
            out.append(ln)
        elif ln.strip() == "":
            out.append(ln)
        # selain itu dibuang (isi versi yang di-drop)
        continue
    out.append(ln)

# bersihkan koma ganda yang mungkin muncul (blok terakhir)
result = "\n".join(out)
result = re.sub(r",(\s*\},\s*\n  \},)", r"\1", result)

with open(D, "w", encoding="utf8") as f:
    f.write(result)
print(f"versi dipertahankan: {kept_count}, dibuang: {dropped}")
