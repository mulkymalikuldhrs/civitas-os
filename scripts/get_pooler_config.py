#!/usr/bin/env python3
"""Ambil konfigurasi pooler resmi proyek Supabase via Management API (SB_PAT)."""
import json
import urllib.request
import os

REF = "jcdjwprehfgtaswqletb"
PAT = ""
for line in open("/home/z/.gitcreds", encoding="utf8"):
    if line.startswith("SB_PAT="):
        PAT = line.split("=", 1)[1].strip().strip('"')
if not PAT:
    raise SystemExit("SB_PAT tidak ada")

req = urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{REF}/config/database/pooler",
    headers={"Authorization": f"Bearer {PAT}"},
)
with urllib.request.urlopen(req, timeout=30) as r:
    data = json.loads(r.read())

# jangan cetak password — cetak host/port/user saja
def shape(url: str) -> str:
    try:
        from urllib.parse import urlparse, unquote
        u = urlparse(url)
        return f"{u.hostname}:{u.port} user={u.username} db={u.path}"
    except Exception:
        return "?"[:40]

if isinstance(data, dict):
    for k, v in data.items():
        if isinstance(v, dict):
            for kk, vv in v.items():
                if isinstance(vv, dict) and "connection_string" in vv:
                    print(f"{k}.{kk}: {shape(vv['connection_string'])}")
                elif isinstance(vv, str) and vv.startswith("postgres"):
                    print(f"{k}.{kk}: {shape(vv)}")
        elif isinstance(v, str) and v.startswith("postgres"):
            print(f"{k}: {shape(v)}")
else:
    print(json.dumps(data, indent=1)[:800])
