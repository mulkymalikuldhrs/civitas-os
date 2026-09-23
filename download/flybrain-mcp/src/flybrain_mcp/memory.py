"""Layer 2: Memory & State Engine ("Mushroom Body Layer").

Engine memori operasional yang terinspirasi arsitektur memori otak lalat
(mushroom body = pusat memori asosiatif Drosophila):

- working  : working memory / konteks aktif (analog: central complex state)
- episodic : kejadian yang dialami agent (analog: kenyon cell traces)
- semantic : fakta/generalisasi yang dikonsolidasi
- valence  : bobot salience -1..1 (analog: dopaminergic DAN signaling pada MB)
- associations : hubungan sparse antar-ingatan (analog: sparse kenyon code)

Implementasi v0: SQLite + keyword/recency/salience scoring (deterministik,
tanpa dependensi eksternal). Roadmap v2: vector search (pgvector/sqlite-vec).
"""

from __future__ import annotations

import json
import math
import re
import sqlite3
import time
import uuid
from pathlib import Path

DEFAULT_DB = Path.home() / ".flybrain" / "flybrain.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS agents(
  agent_id     TEXT PRIMARY KEY,
  name         TEXT,
  device_type  TEXT,
  capabilities TEXT,
  registered_at REAL
);
CREATE TABLE IF NOT EXISTS memories(
  id           TEXT PRIMARY KEY,
  agent_id     TEXT NOT NULL,
  kind         TEXT NOT NULL,          -- working | episodic | semantic
  content      TEXT NOT NULL,
  tags         TEXT,
  valence      REAL DEFAULT 0.0,       -- -1..1
  created_at   REAL,
  last_used_at REAL,
  use_count    INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS associations(
  agent_id   TEXT,
  from_id    TEXT,
  to_id      TEXT,
  strength   REAL,
  created_at REAL,
  PRIMARY KEY (agent_id, from_id, to_id)
);
CREATE TABLE IF NOT EXISTS state(
  agent_id   TEXT,
  key        TEXT,
  value      TEXT,
  updated_at REAL,
  PRIMARY KEY (agent_id, key)
);
CREATE INDEX IF NOT EXISTS idx_mem_agent ON memories(agent_id, kind);
"""

VALID_KINDS = ("working", "episodic", "semantic")
RECALL_HALFLIFE_SECONDS = 7 * 24 * 3600  # recency decay: half-life 7 hari


class MemoryEngine:
    """Penyimpanan memori persisten lintas-agent. Thread-safe per-connection."""

    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = Path(db_path) if db_path else DEFAULT_DB
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(SCHEMA)
        self._conn.commit()

    # ---------------- registry ----------------
    def register_agent(self, agent_id: str, name: str = "", device_type: str = "agent",
                       capabilities: str = "") -> dict:
        now = time.time()
        self._conn.execute(
            "INSERT INTO agents(agent_id,name,device_type,capabilities,registered_at) "
            "VALUES(?,?,?,?,?) ON CONFLICT(agent_id) DO UPDATE SET "
            "name=excluded.name, device_type=excluded.device_type, "
            "capabilities=excluded.capabilities",
            (agent_id, name or agent_id, device_type, capabilities, now),
        )
        self._conn.commit()
        return {"ok": True, "agent_id": agent_id, "device_type": device_type,
                "registered_at": now}

    def get_agent(self, agent_id: str) -> dict | None:
        row = self._conn.execute(
            "SELECT * FROM agents WHERE agent_id=?", (agent_id,)).fetchone()
        return dict(row) if row else None

    # ---------------- memory write ----------------
    def write_memory(self, agent_id: str, content: str, kind: str = "episodic",
                     tags: str = "", valence: float = 0.0) -> dict:
        if kind not in VALID_KINDS:
            return {"ok": False, "error": f"kind harus salah satu dari {VALID_KINDS}"}
        if not content.strip():
            return {"ok": False, "error": "content kosong"}
        valence = max(-1.0, min(1.0, float(valence)))
        mid = uuid.uuid4().hex[:16]
        now = time.time()
        self._conn.execute(
            "INSERT INTO memories(id,agent_id,kind,content,tags,valence,"
            "created_at,last_used_at,use_count) VALUES(?,?,?,?,?,?,?,?,0)",
            (mid, agent_id, kind, content.strip(), tags.strip(), valence, now, now),
        )
        self._conn.commit()
        return {"ok": True, "id": mid, "kind": kind, "agent_id": agent_id}

    # ---------------- memory recall ----------------
    def recall(self, agent_id: str, query: str, k: int = 5, kinds: str = "") -> dict:
        k = max(1, min(50, int(k)))
        wanted = [s.strip() for s in kinds.split(",") if s.strip()] or list(VALID_KINDS)
        rows = self._conn.execute(
            "SELECT * FROM memories WHERE agent_id=? AND kind IN "
            f"({','.join('?' * len(wanted))})",
            (agent_id, *wanted)).fetchall()
        now = time.time()
        q_tokens = set(re.findall(r"[a-z0-9_]+", (query or "").lower()))
        scored = []
        for r in rows:
            c_tokens = set(re.findall(r"[a-z0-9_]+", (r["content"] + " " + (r["tags"] or "")).lower()))
            overlap = len(q_tokens & c_tokens)
            age = max(0.0, now - r["created_at"])
            recency = 0.5 ** (age / RECALL_HALFLIFE_SECONDS)
            salience = (float(r["valence"]) + 1.0) / 2.0
            score = 1.5 * overlap + 0.8 * recency + 0.5 * salience
            scored.append((score, r))
        scored.sort(key=lambda t: t[0], reverse=True)
        top = scored[:k]
        results = []
        for score, r in top:
            self._conn.execute(
                "UPDATE memories SET last_used_at=?, use_count=use_count+1 WHERE id=?",
                (now, r["id"]))
            results.append({
                "id": r["id"], "kind": r["kind"], "content": r["content"],
                "tags": r["tags"], "valence": r["valence"],
                "created_at": r["created_at"], "use_count": r["use_count"],
                "score": round(score, 4),
            })
        self._conn.commit()
        return {"ok": True, "agent_id": agent_id, "query": query, "count": len(results),
                "results": results}

    # ---------------- associations ----------------
    def associate(self, agent_id: str, id_a: str, id_b: str, strength: float = 0.5) -> dict:
        if id_a == id_b:
            return {"ok": False, "error": "tidak boleh mengasosiasikan ingatan dengan dirinya sendiri"}
        found = self._conn.execute(
            "SELECT COUNT(*) c FROM memories WHERE agent_id=? AND id IN (?,?)",
            (agent_id, id_a, id_b)).fetchone()["c"]
        if found < 2:
            return {"ok": False, "error": "salah satu / kedua id tidak ditemukan untuk agent ini"}
        strength = max(0.0, min(1.0, float(strength)))
        self._conn.execute(
            "INSERT OR REPLACE INTO associations(agent_id,from_id,to_id,strength,created_at) "
            "VALUES(?,?,?,?,?)", (agent_id, id_a, id_b, strength, time.time()))
        self._conn.commit()
        return {"ok": True, "agent_id": agent_id, "from": id_a, "to": id_b, "strength": strength}

    # ---------------- working context (state KV) ----------------
    def set_state(self, agent_id: str, key: str, value: str) -> dict:
        self._conn.execute(
            "INSERT OR REPLACE INTO state(agent_id,key,value,updated_at) VALUES(?,?,?,?)",
            (agent_id, key, value, time.time()))
        self._conn.commit()
        return {"ok": True, "agent_id": agent_id, "key": key}

    def get_state(self, agent_id: str) -> dict:
        rows = self._conn.execute(
            "SELECT key,value,updated_at FROM state WHERE agent_id=? ORDER BY key",
            (agent_id,)).fetchall()
        return {"ok": True, "agent_id": agent_id,
                "state": {r["key"]: {"value": r["value"], "updated_at": r["updated_at"]} for r in rows}}

    # ---------------- awareness snapshot ----------------
    def snapshot(self, agent_id: str) -> dict:
        agent = self.get_agent(agent_id)
        state = self.get_state(agent_id)
        recent = self.recall(agent_id, query="", k=5)
        counts = {kind: 0 for kind in VALID_KINDS}
        row = self._conn.execute(
            "SELECT kind, COUNT(*) c FROM memories WHERE agent_id=? GROUP BY kind",
            (agent_id,)).fetchall()
        for r in row:
            counts[r["kind"]] = r["c"]
        n_edges = self._conn.execute(
            "SELECT COUNT(*) c FROM associations WHERE agent_id=?", (agent_id,)).fetchone()["c"]
        return {
            "ok": True,
            "agent_id": agent_id,
            "known_agent": agent is not None,
            "identity": agent,
            "working_context": state.get("state", {}),
            "recent_memories": recent.get("results", []),
            "memory_counts": counts,
            "association_count": n_edges,
            "generated_at": time.time(),
        }

    def stats(self) -> dict:
        agents = self._conn.execute("SELECT COUNT(*) c FROM agents").fetchone()["c"]
        mems = self._conn.execute("SELECT COUNT(*) c FROM memories").fetchone()["c"]
        edges = self._conn.execute("SELECT COUNT(*) c FROM associations").fetchone()["c"]
        return {"ok": True, "db_path": str(self.db_path), "agents": agents,
                "memories": mems, "associations": edges}

    def close(self) -> None:
        self._conn.close()
