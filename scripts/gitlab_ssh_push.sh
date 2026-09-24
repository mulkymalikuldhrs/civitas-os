#!/bin/bash
# gitlab_ssh_push.sh — daftarkan SSH key via API GitLab, lalu force push via SSH altssh:443
source /home/z/.gitcreds
set -u

KEYFILE="$HOME/.ssh/civitas_gitlab"
if [ ! -f "$KEYFILE" ]; then
  mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
  ssh-keygen -t ed25519 -f "$KEYFILE" -N "" -C "civitas-sandbox-$(date +%Y%m%d)" -q
  echo "SSH_KEY_GENERATED"
fi

PUB=$(cat "${KEYFILE}.pub")
# Hapus key lama dengan title sama bila ada (idempoten)
OLD_ID=$(curl -s -H "PRIVATE-TOKEN: $GL_TOKEN" "https://gitlab.com/api/v4/user/keys" | python3 -c "
import sys, json
try:
  keys = json.load(sys.stdin)
  for k in keys:
    if k.get('title') == 'civitas-sandbox':
      print(k['id']); break
except Exception: pass
" 2>/dev/null)
if [ -n "${OLD_ID:-}" ]; then
  curl -s -X DELETE -H "PRIVATE-TOKEN: $GL_TOKEN" "https://gitlab.com/api/v4/user/keys/$OLD_ID" > /dev/null
  echo "OLD_KEY_REMOVED id=$OLD_ID"
fi

RESP=$(curl -s -X POST "https://gitlab.com/api/v4/user/keys" \
  -H "PRIVATE-TOKEN: $GL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"civitas-sandbox\",\"key\":\"$PUB\"}")
echo "$RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'id' in d: print('KEY_ADDED id=' + str(d['id']))
else: print('KEY_ADD_FAIL: ' + json.dumps(d)[:300])
"

cd /home/z/my-project
export GIT_SSH_COMMAND="ssh -i $KEYFILE -o StrictHostKeyChecking=no -o UserKnownHostsFile=$HOME/.ssh/known_hosts_gitlab -p 443"
out=$(git push --force "ssh://git@altssh.gitlab.com/mulkymalikuldhr/civitas-os.git" main:main 2>&1)
rc=$?
echo "$out" | grep -vE "^remote:|^Resolving|^Enumerating|^Counting|^Compressing|^Writing" | tail -4
if [ $rc -eq 0 ]; then
  echo "GITLAB_SSH_PUSH_OK"
  exit 0
fi
echo "GITLAB_SSH_PUSH_FAIL rc=$rc"
exit 1
