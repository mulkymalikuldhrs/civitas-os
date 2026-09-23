"""Layer 3: Connectome Adapter ("Optic Lobe Layer").

Adapter ke data connectome nyata. v0 mendukung FlyWire FAFB (adult female
Drosophila, 139.255 neuron proofread) melalui CAVEclient.

Prinsip: graceful degradation. Server tetap hidup dan seluruh tool memori
tetap berfungsi walau caveclient belum terpasang / token belum di-set.
Pesan error selalu actionable (memberi tahu cara memperbaiki).

Catatan jujur: nama tabel & kolom materialization CAVE dapat berubah antar
versi (mis. 630 / 1300). Fungsi di sini mengembalikan baris apa adanya
(agak raw) agar tidak menyembunyikan skema asli; gunakan
flywire_tables() untuk menginspeksi tabel yang tersedia di datastack.
"""

from __future__ import annotations

import os

DEFAULT_DATASTACK = "flywire_fafb_production"


class FlyWireClient:
    """Wrapper tipis CAVEclient dengan lazy-import dan pesan error actionable."""

    def __init__(self, datastack: str = DEFAULT_DATASTACK, token: str | None = None) -> None:
        self.datastack = datastack
        self.token = token or os.environ.get("FLYWIRE_TOKEN")
        self._client = None

    # ------------- koneksi malas -------------
    def _get(self):
        if self._client is None:
            try:
                from caveclient import CAVEclient  # lazy: opsional
            except ImportError:
                raise RuntimeError(
                    "caveclient belum terpasang. Jalankan: "
                    "pip install 'flybrain-mcp[connectome]' atau pip install caveclient"
                )
            try:
                self._client = CAVEclient(self.datastack)
            except Exception as exc:  # token hilang / datastack salah
                raise RuntimeError(
                    f"Gagal inisialisasi CAVEclient untuk datastack '{self.datastack}': {exc}. "
                    "Dapatkan token di https://globalv1.flywire-daf.com/auth/get_token/ "
                    "lalu set environment variable FLYWIRE_TOKEN."
                )
        return self._client

    # ------------- status -------------
    def status(self) -> dict:
        info = {
            "ok": True,
            "datastack": self.datastack,
            "caveclient_installed": True,
            "token_env_set": bool(self.token),
            "connected": False,
            "note": "",
        }
        try:
            c = self._get()
            info["connected"] = True
            try:
                info["materialization_version"] = c.materialize.get_versions()[0]
            except Exception:
                info["materialization_version"] = "unknown"
            return info
        except RuntimeError as exc:
            info["caveclient_installed"] = "caveclient belum terpasang" not in str(exc)
            info["ok"] = False
            info["note"] = str(exc)
            return info
        except Exception as exc:
            info["ok"] = False
            info["note"] = f"{type(exc).__name__}: {exc}"
            return info

    # ------------- neuron metadata -------------
    def neuron_info(self, root_id: str) -> dict:
        rid = int(root_id)
        c = self._get()
        df = c.materialize.query_table(
            "nuclei_v1", filter_equal_dict={"pt_root_id": rid}, limit=5
        )
        records = df.to_dict(orient="records") if hasattr(df, "to_dict") else str(df)
        return {
            "ok": True,
            "root_id": root_id,
            "datastack": self.datastack,
            "matches": records,
            "codex_url": f"https://codex.flywire.ai/app/search?dataset=fafb&filter_string=%5Ev+{rid}",
            "note": "Skema kolom mengikuti versi materialization; inspeksi dengan flywire_tables bila perlu.",
        }

    # ------------- konektivitas sinaptik -------------
    def connectivity(self, root_id: str, direction: str = "out", limit: int = 10) -> dict:
        if direction not in ("out", "in"):
            return {"ok": False,
                    "error": "direction harus 'out' (target) atau 'in' (sumber)"}
        rid = int(root_id)
        c = self._get()
        if direction == "out":
            df = c.materialize.synapse_query(pre_ids=[rid])
        else:
            df = c.materialize.synapse_query(post_ids=[rid])
        partner_col = "post_root_id" if direction == "out" else "pre_root_id"
        if hasattr(df, "groupby"):
            top = (df.groupby(partner_col).size()
                     .sort_values(ascending=False).head(int(limit)))
            partners = [
                {"partner_root_id": str(pid), "synapse_count": int(n)}
                for pid, n in top.items()
            ]
        else:
            partners = []
        return {"ok": True, "root_id": root_id, "direction": direction,
                "total_synapses": int(len(df)) if hasattr(df, "__len__") else 0,
                "top_partners": partners}

    # ------------- pencarian cell type -------------
    def search_cell_type(self, cell_type: str, limit: int = 10) -> dict:
        c = self._get()
        df = c.materialize.query_table(
            "nuclei_v1", filter_equal_dict={"cell_type": cell_type}, limit=int(limit)
        )
        records = df.to_dict(orient="records") if hasattr(df, "to_dict") else str(df)
        return {"ok": True, "cell_type": cell_type, "matches": records}

    # ------------- inspeksi tabel -------------
    def tables(self) -> dict:
        c = self._get()
        tables = c.materialize.get_tables()
        return {"ok": True, "datastack": self.datastack, "tables": tables}
