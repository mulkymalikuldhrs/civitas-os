// FLYBRAIN KERNEL — mcp-tools.ts
// Katalog tool /api/mcp (sumber tunggal — dipakai route, prompt LLM, dan UI).
// Dipisah dari route agar jumlah tool bisa dirujuk DINAMIS (audit F-07):
// brain.ts (system prompt), GerbangView, RuangKendaliView membaca MCP_TOOLS.length
// — angka tidak akan stale lagi saat tool ditambah.

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  auth: "none" | "bearer";
}

export const MCP_TOOLS: ToolDef[] = [
  {
    name: "system.status",
    description:
      "Status server FLYBRAIN (stateless, zero-storage): waktu, protokol, dan gema kunci bearer bila dilampirkan. Server amnesia — tidak ada sesi/tier yang bisa diklaim dari sisi server.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    auth: "none",
  },
  {
    name: "prt.chat",
    description:
      "Bicara dengan prt — operator otonom FLYBRAIN OS (LLM). Jawaban Bahasa Indonesia berkonteks produk; konteks device bersifat agregat, server tidak menyimpan percakapan.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Pesan untuk prt (maks 2000 karakter)." },
        context: {
          type: "object",
          description: "Konteks agregat opsional dari perangkat pemilik (tier, jumlah rekaman — tanpa isi memori).",
        },
      },
      required: ["message"],
      additionalProperties: false,
    },
    auth: "none",
  },
  {
    name: "connectome.query",
    description:
      "Query atlas connectome: ringkasan region, pencarian neuron virtual, dan statistik makro NYATA (FAFB/FlyWire Nature 2024; CNS jantan Janelia+Google 2026) dengan atribusi. Label jujur: atlas virtual deterministik + angka makro terverifikasi.",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "Kunci region opsional: antennal|calyx|kenyon|central|optic|lateral|fibrillar.",
        },
        q: { type: "string", description: "Pencarian katalog neuron opsional, mis. 'KC_0062'." },
        limit: { type: "number", description: "Maksimum neuron dikembalikan (default 12, maks 50)." },
      },
      additionalProperties: false,
    },
    auth: "none",
  },
  {
    name: "receipt.verify",
    description:
      "Validasi kwitansi flybrain.receipt/v1 (checksum kanonik + masa aktif) TANPA menyimpannya. Butuh bearer FK1_ format-valid + argumen payer (server amnesia: payer harus dinyatakan pemanggil).",
    inputSchema: {
      type: "object",
      properties: {
        receipt: {
          description: "Objek kwitansi flybrain.receipt/v1 (atau string JSON).",
        },
        payer: { type: "string", description: "Username pemilik kwitansi (harus cocok dengan field payer)." },
      },
      required: ["receipt", "payer"],
      additionalProperties: false,
    },
    auth: "bearer",
  },
  {
    name: "memory.write",
    description:
      "Tool memori berjalan di sisi PEMILIK DATA (Service Worker klien / gerbang lokal sw-korteks). Server tidak menyimpan apa pun — endpoint ini sengaja menolak menulis memori.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
      },
      additionalProperties: false,
    },
    auth: "bearer",
  },
  {
    name: "memory.recall",
    description:
      "Tool memori berjalan di sisi PEMILIK DATA (Service Worker klien / gerbang lokal sw-korteks). Server tidak menyimpan apa pun — endpoint ini sengaja menolak membaca memori.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string" },
      },
      additionalProperties: false,
    },
    auth: "bearer",
  },
  {
    name: "creature.list",
    description:
      "Katalog 6 creature BIOSFER (prt, Tradio, Scriba, Lumen, Cresca, Fabro): spesies, peran, organ mandat, refleks offline, genom. Data statis katalog — server tidak menyimpan state creature mana pun.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    auth: "none",
  },
  {
    name: "creature.dispatch",
    description:
      "Kirim STATE creature (dari klien pemilik) → server menalar via LLM → keputusan dikembalikan. STATELESS: server TIDAK menyimpan creature/keputusan — state hidup di klien, keputusan dieksekusi di klien dengan veto konstitusi.",
    inputSchema: {
      type: "object",
      properties: {
        creature: {
          type: "object",
          description:
            "State creature dari klien: { id, energy, wealth, skills, pulseCount, status, lastTrace } (agregat, tanpa isi memori).",
          properties: {
            id: { type: "string" },
            energy: { type: "number" },
            wealth: { type: "number" },
            skills: { type: "array", items: { type: "string" } },
            pulseCount: { type: "number" },
            status: { type: "string" },
            lastTrace: { type: "string" },
          },
          required: ["id"],
        },
        context: {
          type: "object",
          description: "Konteks agregat opsional: { totalRecords, totalKb, beat, ts } — tanpa isi memori.",
        },
      },
      required: ["creature"],
      additionalProperties: false,
    },
    auth: "none",
  },
  {
    name: "world.map",
    description:
      "Peta dunia hidup FLYBRAIN OS v1.2 \"PLANET\" (stateless murni): wire table 8 biome → fitur nyata, rumus iklim (siang-malam, cuaca, musim, angin), dan cara membaca peta planet di klien pemilik. Server tidak menyimpan state dunia — posisi/energi hidup di IndexedDB pemilik.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    auth: "none",
  },
];
