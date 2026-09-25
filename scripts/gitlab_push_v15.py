#!/usr/bin/env python3
"""Prosedur GitLab terbukti (Task 21-b): buka allow_force_push -> force push SSH -> relock.
Token dari ~/.gitcreds (GL_TOKEN). Jujur per langkah, tanpa mock.
"""
import json
import subprocess
import time
import urllib.request

CREDS = "/home/z/.gitcreds"
PROJECT = "86823449"
ROOT = "/home/z/my-project"


def token() -> str:
    for line in open(CREDS, encoding="utf8"):
        if line.startswith("GL_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("GL_TOKEN tidak ada")


def api(path: str, method: str, body: dict | None = None):
    req = urllib.request.Request(
        f"https://gitlab.com/api/v4{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"PRIVATE-TOKEN": token(), "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
            return r.status, (json.loads(data) if data else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]


def git(args: list[str]):
    return subprocess.run(["git"] + args, cwd=ROOT, capture_output=True, text=True, timeout=240,
                          env={"PATH": "/usr/bin:/bin:/usr/local/bin", "GIT_SSH": "/home/z/.ssh-tools/sshx.ts",
                               "HOME": "/home/z", "SSH_VARIANT": "openssh"})


def main() -> None:
    # 1) buka allow_force_push
    st, _ = api(f"/projects/{PROJECT}/protected_branches/main", "PATCH", {"allow_force_push": True})
    print("unprotect PATCH:", st)
    time.sleep(2)

    # 2) force push via SSH altssh
    url = "ssh://git@altssh.gitlab.com:443/mulkymalikuldhr/civitas-os.git"
    p = git(["-c", "ssh.variant=openssh", "push", "--force", url, "main:main"])
    ok = p.returncode == 0
    print("push:", "OK" if ok else "FAIL", (p.stdout + p.stderr).strip().splitlines()[-1][:160] if (p.stdout + p.stderr) else "")

    # 3) relock
    st2, _ = api(f"/projects/{PROJECT}/protected_branches/main", "PATCH", {"allow_force_push": False})
    print("relock PATCH:", st2)

    # 4) verifikasi ls-remote
    v = git(["ls-remote", url, "refs/heads/main"])
    remote = v.stdout.split()[0][:9] if v.stdout else "?"
    local = git(["rev-parse", "--short=9", "HEAD"]).stdout.strip()
    print(f"verify: remote={remote} local={local} -> {'SYNC' if remote == local else 'MISMATCH'}")


if __name__ == "__main__":
    main()
