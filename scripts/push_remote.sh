#!/usr/bin/env bash
# push_remote.sh — Push CIVITAS OS ke remote (GitHub x3 + GitLab) dengan kredensial pemilik.
# KEAMANAN: token TIDAK pernah disimpan di .git/config atau file repo — hanya dipakai
# transient di URL push. Kredensial master: /home/z/.gitcreds (chmod 600, di luar repo).
set -uo pipefail
source /home/z/.gitcreds
cd /home/z/my-project

LOG=/home/z/my-project/tool-results/push_remote.log
mkdir -p tool-results
echo "=== PUSH PIPELINE $(date -Iseconds) ===" | tee "$LOG"

# ---------- [0] Backup full history (bundle, di luar repo) ----------
BUNDLE=/home/z/civitas-os-full-history.bundle
if [ ! -f "$BUNDLE" ]; then
  git bundle create "$BUNDLE" --all 2>&1 | tee -a "$LOG"
  echo "[0] bundle backup: $BUNDLE ($(du -h "$BUNDLE" | cut -f1))" | tee -a "$LOG"
else
  echo "[0] bundle sudah ada: $BUNDLE" | tee -a "$LOG"
fi

# ---------- [1] Untrack noise: .env, tool-results, upload ----------
git rm -r --cached --quiet .env tool-results upload 2>/dev/null
cat >> .gitignore << 'EOF'

# push pipeline hygiene (session 2026-09-23)
.env
tool-results/
upload/
*.bundle
EOF
git add .gitignore scripts/test_supabase_real.mjs
git commit --quiet -m "security: sanitize supabase test script (env-based creds) + ignore env/tool-results" 2>&1 | tee -a "$LOG" || true

# ---------- [2] Squash ke 1 commit bersih (orphan) ----------
git checkout --orphan clean-push 2>&1 | tee -a "$LOG"
git add -A
git commit --quiet -m "CIVITAS OS v1.0 'REALITY' — Autonomous Minecraft Civilization

Kernel: Next.js 16 + Prisma (SQLite) — identity/LLM router/memory/policy/budget/audit
Warga: 8 villager nyata ber-LLM (CENSUS dari dunia) + 9 guild + tool calling teraudit + internet nyata
Ekonomi: ledger immutable, pasar desa matching deterministik, kuant harga pasar nyata (Binance)
Minecraft: Bedrock 19132 — server lokal PocketMine-MP hidup + Aternos (Konfig UI), bot join nyata, chat 2 arah, direktif tubuh dieksekusi dunia
UI: Minecraft-style 12 view otonom + peta + identitas + konfig semua via UI + file graph (219 file / 524 edges)
Bukti: 62/0 invarian, tsc 0, lint bersih, E2E browser, screenshot civ-20..31

Developer: Mulky Malikul Dhaher <mulkymalikuldhr@mail.com>" 2>&1 | tee -a "$LOG"
echo "[2] clean orphan commit: $(git rev-parse --short HEAD) — files: $(git ls-files | wc -l)" | tee -a "$LOG"

# ---------- [3] Ganti main dengan versi bersih ----------
git branch -D main 2>&1 | tee -a "$LOG"
git branch -m clean-push main
echo "[3] main -> $(git rev-parse --short HEAD) (history lama aman di bundle)" | tee -a "$LOG"

# ---------- [4] Buat repo remote (4 host) ----------
GH1="mulkymalikuldhrs"; GH2="mulkymalikuldhaher"; ORG="dhaher-labs"; GLU="mulkymalikuldhr"
mk_gh() { # $1 token $2 owner $3 endpoint
  curl -s -m 30 -X POST -H "Authorization: Bearer $1" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/$3" \
    -d '{"name":"civitas-os","description":"CIVITAS OS — Autonomous Minecraft Civilization: AI villagers (LLM brain + wallet + guild + real tools) living in a real Bedrock world. Kernel = authoritative control plane.","private":false,"has_wiki":false}' \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('  ->', d.get('full_name') or d.get('message'))"
}
echo "[4] create repos:" | tee -a "$LOG"
echo " github/$GH1:"; mk_gh "$GH_MULKYMALIKULDHRS"  "$GH1" "user/repos"           | tee -a "$LOG"
echo " github/$GH2:"; mk_gh "$GH_MULKYMALIKULDHAHER" "$GH2" "user/repos"           | tee -a "$LOG"
echo " github/$ORG:"; mk_gh "$GH_DHAHERLABS"         "$ORG" "orgs/$ORG/repos"      | tee -a "$LOG"
echo " gitlab/$GLU:"; curl -s -m 30 -X POST -H "PRIVATE-TOKEN: $GL_TOKEN" "https://gitlab.com/api/v4/projects" \
    -d "name=civitas-os&description=CIVITAS OS — Autonomous Minecraft Civilization (AI villagers with LLM brains, wallets, guilds, real tools, real Bedrock world)&visibility=public" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('  ->', d.get('path_with_namespace') or d.get('message'))" | tee -a "$LOG"

# ---------- [5] Push ke 4 remote ----------
echo "[5] push:" | tee -a "$LOG"
push1() { echo " --- $1"; eval "$2" 2>&1 | tail -3 | tee -a "$LOG"; }
push1 "github $GH1"  "git push https://oauth2:\$GH_MULKYMALIKULDHRS@github.com/$GH1/civitas-os.git main:main"
push1 "github $GH2"  "git push https://oauth2:\$GH_MULKYMALIKULDHAHER@github.com/$GH2/civitas-os.git main:main"
push1 "github $ORG"  "git push https://oauth2:\$GH_DHAHERLABS@github.com/$ORG/civitas-os.git main:main"
push1 "gitlab $GLU"  "git push https://oauth2:\$GL_TOKEN@gitlab.com/$GLU/civitas-os.git main:main"

# ---------- [6] Verifikasi remote ----------
echo "[6] verify:" | tee -a "$LOG"
for u in "https://github.com/$GH1/civitas-os" "https://github.com/$GH2/civitas-os" "https://github.com/$ORG/civitas-os" "https://gitlab.com/$GLU/civitas-os"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 20 "https://api.github.com/repos/$GH1/civitas-os" 2>/dev/null); echo " $u" | tee -a "$LOG"
done
echo " gh1: $(curl -s -m 20 https://api.github.com/repos/$GH1/civitas-os | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("full_name","?"), "| default_branch:", d.get("default_branch","?"), "| size KB:", d.get("size","?"))' 2>/dev/null)" | tee -a "$LOG"
echo " gh2: $(curl -s -m 20 https://api.github.com/repos/$GH2/civitas-os | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("full_name","?"), "| default_branch:", d.get("default_branch","?"), "| size KB:", d.get("size","?"))' 2>/dev/null)" | tee -a "$LOG"
echo " org: $(curl -s -m 20 https://api.github.com/repos/$ORG/civitas-os | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("full_name","?"), "| default_branch:", d.get("default_branch","?"), "| size KB:", d.get("size","?"))' 2>/dev/null)" | tee -a "$LOG"
echo " gl : $(curl -s -m 20 -H "PRIVATE-TOKEN: $GL_TOKEN" "https://gitlab.com/api/v4/projects/$GLU%2Fcivitas-os" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("path_with_namespace","?"), "| default_branch:", d.get("default_branch","?"), "| size:", d.get("statistics",{}).get("repository_size","n/a"))' 2>/dev/null)" | tee -a "$LOG"

echo "=== DONE $(date -Iseconds) ===" | tee -a "$LOG"
