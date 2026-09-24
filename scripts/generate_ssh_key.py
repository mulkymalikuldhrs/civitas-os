#!/usr/bin/env python3
"""generate_ssh_key.py — ed25519 keypair dalam format OpenSSH (untuk ssh2/lib GitLab)."""
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
import os

priv_path = os.path.expanduser("~/.ssh/civitas_gitlab")
os.makedirs(os.path.dirname(priv_path), exist_ok=True)

key = Ed25519PrivateKey.generate()
pem = key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.OpenSSH,
    serialization.NoEncryption(),
)
pub = key.public_key().public_bytes(
    serialization.Encoding.OpenSSH,
    serialization.PublicFormat.OpenSSH,
)
with open(priv_path, "wb") as f:
    f.write(pem)
os.chmod(priv_path, 0o600)
with open(priv_path + ".pub", "wb") as f:
    f.write(pub + b"\n")
print(pub.decode())
