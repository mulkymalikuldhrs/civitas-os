#!/usr/bin/env python3
"""Patch webpack.common.js prismarine-web-client: arahkan path dependensi
ke node_modules ROOT (sandbox melarang symlink). Idempoten.
"""
P = "/home/z/my-project/node_modules/prismarine-web-client/webpack.common.js"

with open(P, encoding="utf8") as f:
    src = f.read()

repls = [
    ("path.resolve(__dirname, 'node_modules/minecraft-protocol/src/index.js')",
     "path.resolve(__dirname, '../minecraft-protocol/src/index.js')"),
    ("path.join(__dirname, '/node_modules/prismarine-viewer/public/blocksStates/')",
     "path.join(__dirname, '../prismarine-viewer/public/blocksStates/')"),
    ("path.join(__dirname, '/node_modules/prismarine-viewer/public/textures/')",
     "path.join(__dirname, '../prismarine-viewer/public/textures/')"),
    ("path.join(__dirname, '/node_modules/prismarine-viewer/public/worker.js')",
     "path.join(__dirname, '../prismarine-viewer/public/worker.js')"),
]
done = 0
for old, new in repls:
    if old in src:
        src = src.replace(old, new)
        done += 1
with open(P, "w", encoding="utf8") as f:
    f.write(src)
print("replaced:", done, "/", len(repls))
