#!/usr/bin/env python3
"""Patch prismarine-web-client untuk CIVITAS OS v1.5 (idempoten).
Catatan: script ini menghindari pola bracket-h literal karena toolchain
sandbox menghapusnya — hence chr(91) concatenation.
"""
import json
import os

ROOT = "/home/z/my-project/node_modules/prismarine-web-client"
BR = chr(91)  # karakter '['


def patch_index() -> None:
    p = os.path.join(ROOT, "index.js")
    with open(p, encoding="utf8") as f:
        src = f.read()
    # 1) perbaiki destrukturisasi rusak: "ost, port] = hostprompt.split" -> "[host, port] = ..."
    broken = "ost, port] = hostprompt.split"
    good = BR + "host, port] = hostprompt.split"
    fixed1 = broken in src
    src = src.replace(broken, good)
    # 2) service worker off
    sw_old = "if ('serviceWorker' in navigator) {"
    sw_new = "if (false && 'serviceWorker' in navigator) { // CIVITAS PATCH: SW off"
    if sw_new not in src:
        src = src.replace(sw_old, sw_new)
    with open(p, "w", encoding="utf8") as f:
        f.write(src)
    print(f"index.js: destructure_fixed={fixed1}")


def patch_config() -> None:
    p = os.path.join(ROOT, "config.json")
    cfg = {
        "defaultHost": "127.0.0.1",
        "defaultHostPort": 25565,
        "defaultProxy": "",
        "defaultProxyPort": 0,
        "defaultVersion": "1.21.1",
    }
    with open(p, "w", encoding="utf8") as f:
        json.dump(cfg, f, indent=2)
    print("config.json ->", cfg)


def patch_webpack() -> None:
    p = os.path.join(ROOT, "webpack.common.js")
    with open(p, encoding="utf8") as f:
        src = f.read()
    if "WorkboxPlugin.GenerateSW" in src and "CIVITAS PATCH" not in src:
        src = src.replace(
            "new WorkboxPlugin.GenerateSW({",
            "/* CIVITAS PATCH: workbox off */ false && new WorkboxPlugin.GenerateSW({",
        )
        with open(p, "w", encoding="utf8") as f:
            f.write(src)
    print("webpack.common.js: workbox off")


if __name__ == "__main__":
    patch_index()
    patch_config()
    patch_webpack()
    print("PATCH SELESAI")
