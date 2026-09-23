"""FlyBrain MCP Server - Layer 1: Protocol.

Satu tool-surface untuk semua klien: AI coding agent (Claude Code, opencode,
Cursor), asisten (Claude Desktop, Hermes, QnA bots), dan perangkat
IoT/drone/robotik via bridge HTTP (lihat README).

Menjalankan:
  flybrain-mcp                     # stdio (lokal, default)
  flybrain-mcp --http --port 8000  # streamable HTTP (hosted / device bridge)
"""

from __future__ import annotations

import argparse
import json

from fastmcp import FastMCP

from .flywire import FlyWireClient
from .memory import MemoryEngine

INSTRUCTIONS = (
    "FlyBrain MCP: lapisan 'otak' universal. (1) memory_write / memory_recall / "
    "awareness_snapshot untuk memori operasional persisten lintas-sesi; "
    "(2) flywire_* untuk meng-query connectome nyata otak lalat (FlyWire FAFB) "
    "via CAVE. Panggil awareness_snapshot(agent_id) di awal setiap sesi agar "
    "agent langsung 'sadar' konteks sebelumnya. Framing jujur: ini operational "
    "awareness + memory, bukan consciousness biologis."
)

mcp = FastMCP("FlyBrain", instructions=INSTRUCTIONS)

mem = MemoryEngine()
fw = FlyWireClient()


# ============================================================
#  Registry agent/perangkat
# ============================================================
@mcp.tool
def registry_register(agent_id: str, name: str = "", device_type: str = "agent",
                      capabilities: str = "") -> dict:
    """Daftarkan agent/perangkat ke FlyBrain. device_type contoh:
    'agent', 'coding-agent', 'robot', 'drone', 'iot', 'qna-bot'.
    capabilities: string bebas, mis. 'vision,navigation,speech'."""
    return mem.register_agent(agent_id, name, device_type, capabilities)


# ============================================================
#  Memory tools (Mushroom Body layer)
# ============================================================
@mcp.tool
def memory_write(agent_id: str, content: str, kind: str = "episodic",
                 tags: str = "", valence: float = 0.0) -> dict:
    """Simpan ingatan persisten. kind: 'episodic' (kejadian), 'semantic'
    (fakta/generalisasi), 'working' (konteks sesi). valence: salience -1..1
    (positif=sering diingat, negatif=pengalaman buruk). tags dipisah koma."""
    return mem.write_memory(agent_id, content, kind, tags, valence)


@mcp.tool
def memory_recall(agent_id: str, query: str, k: int = 5, kinds: str = "") -> dict:
    """Tarik ingatan relevan. Skor = keyword-overlap + recency (half-life 7 hari)
    + salience (valence). kinds: filter 'episodic,semantic' (opsional)."""
    return mem.recall(agent_id, query, k, kinds)


@mcp.tool
def memory_associate(agent_id: str, id_a: str, id_b: str, strength: float = 0.5) -> dict:
    """Tautkan dua ingatan (asosiasi sparse ala kenyon cell). id = hasil
    memory_write/memory_recall."""
    return mem.associate(agent_id, id_a, id_b, strength)


# ============================================================
#  Working context (central-complex style state)
# ============================================================
@mcp.tool
def context_set(agent_id: str, key: str, value: str) -> dict:
    """Set state kerja aktif, mis. key='current_task', value='patrol perimeter'.
    Ini working memory yang dibaca awareness_snapshot."""
    return mem.set_state(agent_id, key, value)


@mcp.tool
def context_get(agent_id: str) -> dict:
    """Baca seluruh state kerja aktif agent."""
    return mem.get_state(agent_id)


# ============================================================
#  Awareness (satu panggilan 'jadi aware')
# ============================================================
@mcp.tool
def awareness_snapshot(agent_id: str) -> dict:
    """SATU panggilan untuk 'menyala': identitas + working context + ingatan
    terbaru + statistik memori. Panggil di awal sesi agent/perangkat."""
    return mem.snapshot(agent_id)


@mcp.tool
def flybrain_status() -> dict:
    """Status server: engine memori + koneksi FlyWire/CAVE + petunjuk setup."""
    ms = mem.stats()
    fs = fw.status()
    return {
        "ok": True,
        "memory": ms,
        "connectome": fs,
        "setup_hint": (
            "Tanpa konfigurasi: semua tool memori siap pakai. "
            "Untuk data connectome nyata: pip install 'flybrain-mcp[connectome]' "
            "dan set FLYWIRE_TOKEN (https://globalv1.flywire-daf.com/auth/get_token/)."
        ),
    }


# ============================================================
#  Connectome tools (Optic Lobe layer - FlyWire FAFB)
# ============================================================
@mcp.tool
def flywire_neuron(root_id: str) -> dict:
    """Metadata neuron FlyWire (cell type, class, posisi) dari root ID,
    mis. '720575940622872870'. Butuh caveclient + FLYWIRE_TOKEN."""
    try:
        return fw.neuron_info(root_id)
    except Exception as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}",
                "fix": flybrain_status.__doc__ or "panggil flybrain_status"}


@mcp.tool
def flywire_connectivity(root_id: str, direction: str = "out", limit: int = 10) -> dict:
    """Partner sinaptik teratas sebuah neuron. direction 'out' = axonal targets,
    'in' = dendritic sources. Mengembalikan partner + jumlah sinapsis."""
    try:
        return fw.connectivity(root_id, direction, limit)
    except Exception as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}


@mcp.tool
def flywire_search_cell_type(cell_type: str, limit: int = 10) -> dict:
    """Cari neuron berdasarkan cell type teranotasi, mis. 'T4a', 'MBON01'."""
    try:
        return fw.search_cell_type(cell_type, limit)
    except Exception as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}


@mcp.tool
def flywire_tables() -> dict:
    """Daftar tabel yang tersedia di materialization CAVE FlyWire."""
    try:
        return fw.tables()
    except Exception as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}


# ============================================================
#  Resource + Prompt
# ============================================================
@mcp.resource("flybrain://agents/{agent_id}/context")
def agent_context(agent_id: str) -> str:
    """Konteks agent sebagai resource MCP (bisa di-subscribe klien)."""
    return json.dumps(mem.snapshot(agent_id), indent=2, default=str)


@mcp.prompt
def flybrain_bootstrap(agent_id: str) -> str:
    """Prompt bootstrap: instruksi standar agar agent 'menyala' dengan FlyBrain."""
    return (
        f"Kamu adalah agent dengan id '{agent_id}' yang terhubung ke FlyBrain MCP. "
        "Langkah pertama: panggil tool awareness_snapshot(agent_id) untuk memuat "
        "identitas, konteks kerja, dan ingatan relevan. Setelah itu: (1) perbarui "
        "context_set untuk tugas aktif; (2) simpan temuan penting dengan "
        "memory_write (episodic untuk kejadian, semantic untuk fakta); (3) "
        "sebelum keputusan penting, memory_recall kata kunci relevan. "
        "Jangan pernah mengklaim consciousness biologis - ini lapisan memori "
        "operasional + data connectome."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="FlyBrain MCP server")
    parser.add_argument("--http", action="store_true",
                        help="jalankan sebagai streamable HTTP (default: stdio)")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--db", default=None, help="path database SQLite memori")
    args = parser.parse_args()

    if args.db:
        global mem
        mem.close()
        mem = MemoryEngine(args.db)

    if args.http:
        mcp.run(transport="http", host=args.host, port=args.port)
    else:
        mcp.run()


if __name__ == "__main__":
    main()
