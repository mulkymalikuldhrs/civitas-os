#!/bin/bash
# force_push_all.sh — force push CIVITAS OS ke 4 remote (permintaan pemilik: "force push")
# Token transient via URL, tidak pernah disimpan di repo.
set -u
source /home/z/.gitcreds
cd /home/z/my-project

LOCAL=$(git rev-parse HEAD)
echo "LOCAL_HEAD=$LOCAL"
echo "================ FORCE PUSH ================"

push_one() {
  local name="$1" url="$2"
  local out
  out=$(git push --force "$url" main:main 2>&1)
  local rc=$?
  if [ $rc -eq 0 ]; then
    echo "$name: OK_FORCE"
  else
    echo "$name: FAIL"
    echo "$out" | tail -3 | sed 's/^/    /'
  fi
  return $rc
}

push_one gh-mulkymalikuldhrs    "https://mulkymalikuldhrs:${GH_MULKYMALIKULDHRS}@github.com/mulkymalikuldhrs/civitas-os.git"
push_one gh-mulkymalikuldhaher  "https://mulkymalikuldhaher:${GH_MULKYMALIKULDHAHER}@github.com/mulkymalikuldhaher/civitas-os.git"
push_one dhaher-labs            "https://mulkymalikuldhaher:${GH_DHAHERLABS}@github.com/dhaher-labs/civitas-os.git"
push_one gitlab                 "https://mulkymalikuldhr:${GL_TOKEN}@gitlab.com/mulkymalikuldhr/civitas-os.git"

echo "================ VERIFY LS-REMOTE ================"
for r in "gh-mulkymalikuldhrs" "gh-mulkymalikuldhaher" "dhaher-labs" "gitlab"; do
  u=$(git remote get-url "$r")
  # sisipkan token transient untuk ls-remote
  case "$r" in
    gh-mulkymalikuldhrs)   u="https://mulkymalikuldhrs:${GH_MULKYMALIKULDHRS}@github.com/mulkymalikuldhrs/civitas-os.git";;
    gh-mulkymalikuldhaher) u="https://mulkymalikuldhaher:${GH_MULKYMALIKULDHAHER}@github.com/mulkymalikuldhaher/civitas-os.git";;
    dhaher-labs)           u="https://mulkymalikuldhaher:${GH_DHAHERLABS}@github.com/dhaher-labs/civitas-os.git";;
    gitlab)                u="https://mulkymalikuldhr:${GL_TOKEN}@gitlab.com/mulkymalikuldhr/civitas-os.git";;
  esac
  head_sha=$(git ls-remote "$u" refs/heads/main 2>/dev/null | cut -f1)
  if [ "$head_sha" = "$LOCAL" ]; then
    echo "$r: SYNC @${head_sha:0:7}"
  else
    echo "$r: MISMATCH remote=${head_sha:0:7} local=${LOCAL:0:7}"
  fi
done
