#!/bin/bash
# gitlab_retry_push.sh — force push GitLab dengan cooldown anti-abuse
source /home/z/.gitcreds
URL="https://mulkymalikuldhr:${GL_TOKEN}@gitlab.com/mulkymalikuldhr/civitas-os.git"
cd /home/z/my-project

for i in 1 2; do
  echo "--- ATTEMPT $i $(date -u +%H:%M:%S) ---"
  out=$(git push --force "$URL" main:main 2>&1)
  rc=$?
  echo "$out" | grep -vE "^remote:|^Resolving|^Enumerating|^Counting|^Compressing|^Writing" | tail -4
  if [ $rc -eq 0 ]; then
    sha=$(git ls-remote "$URL" refs/heads/main | cut -f1)
    echo "GITLAB_PUSH_OK remote_main=$sha"
    exit 0
  fi
  [ $i -eq 1 ] && sleep 75
done
echo "GITLAB_PUSH_STILL_BLOCKED"
exit 1
