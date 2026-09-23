"""Smoke test FlyBrain MCP - jalankan: python tests/smoke_test.py

Menguji (tanpa kredensial eksternal):
1. list_tools   -> tool surface terdaftar
2. registry_register + memory_write + memory_recall + associate
3. context_set/get + awareness_snapshot
4. flywire_status -> graceful degradation tanpa caveclient/token
"""

import asyncio
import os
import tempfile

from fastmcp import Client

from flybrain_mcp.server import mcp


async def main() -> None:
    db = os.path.join(tempfile.mkdtemp(), "test_flybrain.db")
    # Inisialisasi ulang engine memori pada DB sementara agar test idempotent
    from flybrain_mcp import server as srv
    srv.mem.close()
    srv.mem = srv.MemoryEngine(db)

    async with Client(mcp) as c:
        tools = await c.list_tools()
        names = sorted(t.name for t in tools)
        print(f"[1] tools terdaftar ({len(names)}):", ", ".join(names))
        assert "awareness_snapshot" in names and "flywire_neuron" in names

        r = await c.call_tool("registry_register",
                              {"agent_id": "hermes-01", "device_type": "agent",
                               "capabilities": "reasoning,tools"})
        print("[2] register:", r.data)

        r = await c.call_tool("memory_write",
                              {"agent_id": "hermes-01",
                               "content": "pengguna suka ringkasan singkat sebelum detail",
                               "kind": "semantic", "tags": "preferensi,gaya",
                               "valence": 0.6})
        print("[3] write:", r.data)
        mem_id = r.data["id"]

        r = await c.call_tool("memory_write",
                              {"agent_id": "hermes-01",
                               "content": "deploy gagal di server staging 2026-09-20",
                               "kind": "episodic", "valence": -0.8})
        print("[4] write episodic:", r.data)

        r = await c.call_tool("memory_recall",
                              {"agent_id": "hermes-01", "query": "preferensi ringkasan"})
        print("[5] recall:", r.data)

        other_ids = [x["id"] for x in r.data["results"] if x["id"] != mem_id]
        assert other_ids, "perlu >=2 ingatan berbeda untuk uji asosiasi"
        r = await c.call_tool("memory_associate",
                              {"agent_id": "hermes-01", "id_a": mem_id, "id_b": other_ids[0]})
        print("[6] associate:", r.data)
        assert r.data["ok"], f"asosiasi gagal: {r.data}"

        await c.call_tool("context_set", {"agent_id": "hermes-01",
                                          "key": "current_task", "value": "uji flybrain"})
        r = await c.call_tool("awareness_snapshot", {"agent_id": "hermes-01"})
        snap = r.data
        print("[7] snapshot aware:", snap["known_agent"],
              "| context:", snap["working_context"],
              "| counts:", snap["memory_counts"])

        r = await c.call_tool("flybrain_status", {})
        print("[8] status:", r.data["connectome"]["note"][:120])

        r = await c.call_tool("flywire_neuron", {"root_id": "720575940622872870"})
        print("[9] flywire (tanpa token):", r.data.get("ok"), "-", str(r.data.get("error", ""))[:80])

    print("\nSMOKE TEST: ALL PASSED")


if __name__ == "__main__":
    asyncio.run(main())
