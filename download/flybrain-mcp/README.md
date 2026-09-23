# FlyBrain MCP

**Lapisan "otak" universal berbasis Model Context Protocol (MCP):**
memori operasional persisten + akses data connectome otak lalat (FlyWire)
untuk AI agent, coding agent, QnA bot, robotik, drone, dan IoT — sekali
pasang, semua klien pakai, tanpa wiring ulang.

> **Framing jujur:** "aware" di sini = *operational awareness* — agent
> memuat identitas, konteks kerja, dan ingatan relevan dalam satu panggilan,
> plus bisa men-query data connectome nyata. Ini BUKAN consciousness
> biologis. Kami memakai otak lalat sebagai (a) sumber data eksplisit dan
> (b) inspirasi arsitektur memori, bukan klaim metafisik.

---

## Arsitektur (3 layer)

```
┌────────────────────────────────────────────────────────────┐
│ LAYER 1 · PROTOCOL (server.py)                             │
│  MCP stdio (lokal) + MCP streamable HTTP (hosted/bridge)   │
│  Klien: Claude Desktop/Code, opencode, Cursor, Hermes,     │
│  QnA bot, IoT/drone/robot via HTTP bridge                  │
├────────────────────────────────────────────────────────────┤
│ LAYER 2 · MEMORY & STATE (memory.py) — "Mushroom Body"     │
│  registry agent → episodic/semantic/working memory         │
│  valence (salience) · asosiasi sparse (kenyon-cell style)  │
│  awareness_snapshot = satu panggilan "menyala"             │
├────────────────────────────────────────────────────────────┤
│ LAYER 3 · CONNECTOME (flywire.py) — "Optic Lobe"           │
│  FlyWire FAFB via CAVEclient (graceful degradation)        │
│  Roadmap: neuPrint (hemibrain), VFB, male-CNS 2026         │
└────────────────────────────────────────────────────────────┘
```

## Instalasi

```bash
# dari repo ini
pip install -e .                 # inti (memori) — tanpa dependensi berat
pip install -e ".[connectome]"   # + CAVEclient untuk data connectome nyata

# atau langsung
python src/flybrain_mcp/server.py
```

## Menjalankan

```bash
flybrain-mcp                      # stdio (default, untuk Claude Desktop dll.)
flybrain-mcp --http --port 8000   # streamable HTTP (hosted / device bridge)
```

## Konfigurasi klien

### Claude Desktop (`claude_desktop_config.json`)
Lihat `examples/claude_desktop_config.json`.

### opencode (`opencode.json`)
Lihat `examples/opencode.json` — skema resmi: https://opencode.ai/docs/mcp-servers

### Hermes / agent lain (pola generik MCP)
```json
{ "mcpServers": { "flybrain": { "command": "python", "args": ["-m", "flybrain_mcp.server"] } } }
```
Untuk perangkat non-MCP (IoT/drone): jalankan server mode `--http`, lalu
panggil tool via HTTP dari firmware/gateway (pola bridge di roadmap v1).

## Token FlyWire (opsional, untuk data connectome nyata)

1. Buka https://globalv1.flywire-daf.com/auth/get_token/ (login gratis).
2. `export FLYWIRE_TOKEN="..."` atau isi di konfigurasi klien.

Tanpa token, semua tool memori tetap berfungsi penuh; tool `flywire_*`
mengembalikan pesan error yang actionable (bukan crash).

## Tool surface (12 tools)

| Tool | Fungsi |
|---|---|
| `registry_register` | daftarkan agent/perangkat (agent, coding-agent, robot, drone, iot, qna-bot) |
| `memory_write` | simpan ingatan (episodic / semantic / working) + valence + tags |
| `memory_recall` | tarik ingatan relevan (keyword + recency + salience) |
| `memory_associate` | tautkan dua ingatan (asosiasi sparse) |
| `context_set` / `context_get` | working memory / state kerja aktif |
| `awareness_snapshot` | **satu panggilan "menyala"**: identitas + konteks + ingatan |
| `flybrain_status` | status server + petunjuk setup |
| `flywire_neuron` | metadata neuron dari root ID (mis. `720575940622872870`) |
| `flywire_connectivity` | partner sinaptik teratas (in/out) |
| `flywire_search_cell_type` | cari neuron per cell type teranotasi |
| `flywire_tables` | inspeksi tabel materialization CAVE |

Resource MCP: `flybrain://agents/{agent_id}/context`
Prompt: `flybrain_bootstrap`

## Uji

```bash
PYTHONPATH=src python tests/smoke_test.py
```

Hasil terverifikasi (fastmcp 2.14.3, caveclient 8.2.1): 12 tools terdaftar;
register → write → recall → associate → snapshot → status semua `ok`;
`flywire_*` tanpa token menghasilkan pesan auth yang actionable.

## Lisensi & atribusi

- Kode repo ini: MIT.
- Data FlyWire: publikasi data FlyWire dilisensikan **CC BY-NC 4.0**
  (lihat https://edit.flywire.ai — "FlyWire Principles"). Wajib atribusi;
  **non-komersial untuk redistribusi data mentah**. Layanan komersial harus
  berbasis infrastruktur/tools (bukan menjual ulang data) dan sebaiknya
  dikonfirmasi ke pemilik data sebelum peluncuran.

## Roadmap

- **v0.1 (ini)** — stdio+HTTP, memori SQLite, adapter FlyWire, konfigurasi klien.
- **v1.0** — hosted multi-tenant (Postgres + pgvector), API key, dashboard.
- **v1.5** — bridge IoT/robotik (REST/MQTT→MCP), SDK Python/JS.
- **v2.0** — consolidator ingatan (episodic→semantic otomatis, MB-inspired),
  adapter neuPrint/VFB/male-CNS, "instinct packs" untuk robot.
