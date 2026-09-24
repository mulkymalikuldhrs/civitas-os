#!/usr/bin/env python3
"""supabase_ddl.py — jalankan DDL (buat semua tabel Prisma) via Supabase Management API."""
import json, sys, urllib.request

PAT = None
for line in open("/home/z/.gitcreds"):
    if line.startswith("SB_PAT="):
        PAT = line.split("=", 1)[1].strip().strip('"')
REF = "jcdjwprehfgtaswqletb"
SQL = open("/tmp/supabase_init.sql").read()

def run_query(q):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": q}).encode(),
        headers={"Authorization": f"Bearer {PAT}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode()[:200]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]
    except Exception as e:
        return 0, str(e)[:200]

# pecah per statement (trim trailing whitespace/komentar kosong)
stmts = [s.strip() for s in SQL.split(";") if s.strip() and not all(l.strip().startswith("--") or not l.strip() for l in s.strip().splitlines())]
print(f"{len(stmts)} statement")
fails = 0
for i, s in enumerate(stmts, 1):
    code, body = run_query(s)
    first = s.splitlines()[0][:70]
    if code == 200:
        print(f"OK  {i:3d}/{len(stmts)} {first}")
    else:
        # "already exists" dianggap sukses idempoten
        if "already exists" in body:
            print(f"SKIP {i:3d}/{len(stmts)} {first} (sudah ada)")
        else:
            fails += 1
            print(f"FAIL {i:3d}/{len(stmts)} {first} → HTTP {code}: {body[:160]}")
print("HASIL:", "SEMPURNA" if fails == 0 else f"{fails} gagal")
sys.exit(1 if fails else 0)
