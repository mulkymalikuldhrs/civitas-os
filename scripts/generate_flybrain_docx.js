/**
 * Generator: FlyBrain MCP — Riset & Blueprint (docx, Bahasa Indonesia)
 * Recipe: R1 (Pure Paragraph Left) + palet DM-1 (Deep Cyan) — docType report/ai
 * Arsitektur: 3 section (cover margin-0 / front-matter TOC Roman / body Arabic)
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  SectionType, TableOfContents, TableLayoutType,
} = require("docx");
const fs = require("fs");
const _imgSize = require("image-size");
const sizeOf = _imgSize.imageSize || _imgSize.default || _imgSize;

// ───────────────────────── Palet DM-1 (Deep Cyan) ─────────────────────────
const P = {
  bg: "162235",
  accent: "37DCF2",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
  headingColor: "0F2233",
  body: "000000",
  secondary: "666666",
};

const noBorders = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
};
const allNoBorders = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
};

// ─────────────── calcTitleLayout (adaptasi lebar huruf Latin) ───────────────
// Karakter Latin ≈ 0.52 x lebar CJK pada font size yang sama.
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."\u3001\u3002\uFF0C\uFF1B\uFF1A\uFF01\uFF1F", ..."-_\u2014\u2013\u00B7/", ..." \t", ":"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const latinFactor = 0.52;
  const charWidth = (pt) => pt * 20 * latinFactor;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 800, pageHeight = 16838,
    marginTop = 0, marginBottom = 0,
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight +
    metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ───────────────────────── Recipe R1: Pure Paragraph ─────────────────────────
function buildCoverR1(config) {
  const PAL = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length,
    fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: PAL.accent, space: 12 };
  const children = [];

  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));

  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PAL.accent, space: 8 } },
      children: [new TextRun({
        text: config.englishLabel.split("").join("  "),
        size: 18, color: PAL.accent, font: { ascii: "Arial", eastAsia: "SimHei" }, characterSpacing: 40,
      })],
    }));
  }

  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({
        text: titleLines[i], size: titleSize, bold: true,
        color: PAL.cover.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" },
      })],
    }));
  }

  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 800 },
      children: [new TextRun({
        text: config.subtitle, size: 24, color: PAL.cover.subtitleColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" },
      })],
    }));
  }

  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({
        text: line, size: 24, color: PAL.cover.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" },
      })],
    }));
  }

  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));

  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: PAL.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: PAL.cover.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: PAL.cover.footerColor, font: { ascii: "Arial" } }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: PAL.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// ───────────────────────── Builder konten ─────────────────────────
const FONT_BODY = { ascii: "Times New Roman", eastAsia: "SimSun" };
const FONT_HEAD = { ascii: "Times New Roman", eastAsia: "SimHei" };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.headingColor, font: FONT_HEAD })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 30, color: P.headingColor, font: FONT_HEAD })],
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 24, color: P.body, font: FONT_BODY, ...opts })],
  });
}
function pRuns(runs) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: 80 },
    children: runs.map(r => new TextRun({ size: 24, color: P.body, font: FONT_BODY, ...r })),
  });
}
function bullet(text, boldPrefix) {
  const runs = [];
  if (boldPrefix) runs.push(new TextRun({ text: boldPrefix, bold: true, size: 24, color: P.body, font: FONT_BODY }));
  runs.push(new TextRun({ text, size: 24, color: P.body, font: FONT_BODY }));
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    bullet: { level: 0 },
    spacing: { line: 312, after: 60 },
    children: runs,
  });
}
function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 200, line: 276 },
    children: [new TextRun({ text, size: 21, color: P.secondary, font: FONT_BODY })],
  });
}
function tableTitle(text) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: P.headingColor, font: FONT_BODY })],
  });
}
function cell(text, opts = {}) {
  return new TableCell({
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      spacing: { line: 276 },
      children: [new TextRun({
        text, size: 21, bold: !!opts.bold,
        color: opts.color || P.body, font: FONT_BODY,
      })],
    })],
    shading: { type: ShadingType.CLEAR, fill: opts.fill || "FFFFFF" },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    width: { size: opts.w, type: WidthType.PERCENTAGE },
  });
}
function tbl(headers, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        tableHeader: true, cantSplit: true,
        children: headers.map((t, i) => cell(t, { bold: true, color: P.table.headerText, fill: P.table.headerBg, w: widths[i] })),
      }),
      ...rows.map((r, ri) => new TableRow({
        cantSplit: true,
        children: r.map((t, i) => cell(t, { w: widths[i], fill: ri % 2 === 1 ? P.table.surface : "FFFFFF" })),
      })),
    ],
  });
}
function figure(path, displayWidth) {
  const buf = fs.readFileSync(path);
  const dims = sizeOf(buf);
  const displayHeight = Math.round(displayWidth * (dims.height / dims.width));
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 60 },
    children: [new ImageRun({ data: buf, transformation: { width: displayWidth, height: displayHeight }, type: "png" })],
  });
}
function code(lines) {
  return lines.map((line, i) => new Paragraph({
    alignment: AlignmentType.LEFT,
    shading: { type: ShadingType.CLEAR, fill: "F4F6F8" },
    spacing: { line: 264, before: i === 0 ? 120 : 0, after: i === lines.length - 1 ? 160 : 0 },
    indent: { left: 240, right: 240 },
    children: [new TextRun({ text: line === "" ? " " : line, size: 18, color: "24323D", font: { ascii: "Courier New", eastAsia: "SimSun" } })],
  }));
}
function refItem(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 276, after: 60 },
    indent: { left: 360, hanging: 360 },
    children: [new TextRun({ text, size: 21, color: P.body, font: FONT_BODY })],
  });
}

// ═════════════════════════ KONTEN BAB 1-5 ═════════════════════════
const bab1 = [
  h1("1. Ringkasan Eksekutif"),
  p("Dokumen ini merangkum hasil riset otonom dan persiapan teknis atas satu peluang produk: mengubah gelombang viral data connectome (peta sambungan saraf lengkap) otak lalat buah menjadi sebuah infrastruktur universal bernama FlyBrain MCP. Pemicu riset adalah lonjakan perhatian publik pada September 2026, ketika konsorsium HHMI Janelia dan Google mengumumkan peta lengkap sistem saraf pusat lalat jantan dengan lebih dari 166.000 neuron dan sekitar 125 juta sambungan sinaptik, disusul gelombang eksperimen komunitas yang memakai dataset tersebut untuk membangun aplikasi AI. Pada saat yang sama, pengguna telah menemukan tool bernama Calyx yang teridentifikasi sebagai MCP (Model Context Protocol) milik Virtual Fly Brain."),
  p("Temuan utama riset: VFB MCP/Calyx adalah tool pencarian basis pengetahuan anatomi otak lalat melalui LLM, dan belum menyentuh tiga area yang justru paling bernilai bagi ekosistem agent, yaitu query konektivitas sinaptik tingkat sinapsis, lapisan memori persisten lintas-agent, dan distribusi universal ke beragam klien. Celah tersebut menjadi ruang posisi produk FlyBrain MCP: satu server MCP yang menyatukan tool data connectome nyata (via API CAVE/FlyWire), engine memori operasional yang terinspirasi arsitektur mushroom body otak lalat, dan registry agent agar perangkat apa pun yang dipasangkan langsung memuat identitas, konteks, dan ingatannya dalam satu panggilan."),
  p("Sebagai bukti kelayakan, MVP sudah dibangun dan diuji dalam sesi ini: repo flybrain-mcp berbasis FastMCP dengan 12 tool terdaftar, teruji end-to-end untuk jalur memori (register, write, recall, associate, snapshot) dan teruji hingga batas autentikasi untuk jalur connectome (degradasi terkontrol dengan pesan perbaikan yang actionable saat token belum di-set). Konfigurasi contoh untuk Claude Desktop, opencode, dan pola integrasi Hermes juga sudah disiapkan."),
  p("Rekomendasi strategis: lanjutkan sebagai layanan SaaS open-core bernama FlyBrain-as-a-Service dengan framing yang jujur, yaitu operational awareness dan memori, bukan klaim consciousness biologis. Satu risiko material yang harus diselesaikan sebelum peluncuran komersial adalah lisensi data FlyWire (CC BY-NC 4.0), yang melarang penjualan ulang data mentah dan menuntut model bisnis berbasis infrastruktur dan tools."),
];

const bab2 = [
  h1("2. Latar Belakang, Tujuan, dan Metode Riset"),
  h2("2.1 Latar Belakang dan Pertanyaan Inti"),
  p("Permintaan kerja yang mendasari dokumen ini berbunyi: cari tahu dan siapkan segalanya secara otonom tentang otak lalat yang sedang viral, kemungkinan menghubungkannya ke Hermes atau membuatnya global sebagai MCP, sehingga semua tools, AI agent, coding agent, opencode, bot QnA, dan lainnya bisa memakainya secara universal tanpa mengulang-ulang mapping atau wiring. Pengguna juga menemukan proyek Calyx MCP dan contoh URL pencarian neuron di Codex FlyWire. Pertanyaan intinya dapat dirumuskan: apakah data otak lalat dapat diubah menjadi infrastruktur memori dan kesadaran operasional yang universal untuk agent dan perangkat, dan bagaimana melakukannya hingga level SaaS."),
  h2("2.2 Tujuan dan Batasan"),
  p("Tujuan riset mencakup empat hal: memverifikasi fakta di balik fenomena viral otak lalat; memetakan data, API, dan tool yang tersedia termasuk Calyx/VFB MCP; merancang arsitektur FlyBrain MCP yang menutup celah yang ada; serta menyiapkan MVP nyata dan kerangka bisnis SaaS. Batasan yang disepakati: dokumen ini tidak mengklaim kemampuan membuat perangkat menjadi conscious dalam pengertian filosofis; yang dibangun adalah lapisan memori operasional dan akses data connectome. Evaluasi lapangan terhadap seluruh API eksternal juga dibatasi oleh kebutuhan token autentikasi milik pengguna."),
  h2("2.3 Metode dan Hierarki Bukti"),
  p("Riset dilakukan pada 21 September 2026 melalui 12 kueri pencarian web terhadap sumber primer (flywire.ai, blog.google, research.google, hhmi.org, janelia.org, virtualflybrain.org, opencode.ai, dokumen Nature dan CAVEclient di GitHub), sumber media (WIRED, Harvard, Princeton, NIMH, HHMI), dan sumber sekunder komunitas. Klaim diklasifikasikan berdasarkan kekuatan buktinya: fakta langsung dari sumber primer diberi prioritas tertinggi, laporan media sebagai bukti menengah, dan tulisan blog komunitas sebagai indikator wacana, bukan bukti. Selain riset desktop, dilakukan pembangunan dan pengujian MVP nyata (build-and-test) sebagai metode validasi kelayakan teknis, dengan hasil uji yang tercatat pada Bab 7."),
];

const bab3 = [
  h1("3. Fenomena Viral Otak Lalat dan Relevansinya bagi AI"),
  h2("3.1 Fakta Kunci yang Terkonfirmasi"),
  p("Gelombang viral September 2026 berdiri di atas dua pilar data besar. Pilar pertama adalah connectome otak lalat betina dewasa (dataset FAFB, Full Adult Fly Brain) yang diselesaikan konsorsium FlyWire dan diterbitkan di Nature pada 2024: 139.255 neuron ter-proofread dengan lebih dari 50 juta sinapsis, disertai anotasi tipe sel yang menempatkan sekitar 8.400 tipe sel berbeda. Pilar kedua adalah pengumuman 3 September 2026 oleh HHMI Janelia, Google, dan mitra mengenai peta lengkap sistem saraf pusat lalat jantan yang mencakup otak plus tali saraf ventral (analog tulang belakang), dengan lebih dari 166.000 neuron dan sekitar 125 juta sambungan sinaptik."),
  p("Bukti momentum viral terlihat dari lini masa dua minggu terakhir: pada 14 September 2026 MindStudio melaporkan hobiis melatih dataset connectome untuk menyortir surel dan bermain gim; pada 16 September 2026 WIRED menerbitkan artikel I Trained a Fly Brain to Generate WIRED Story Ideas yang mendokumentasikan pembuatan aplikasi PitchFly menggunakan peta otak lalat open-source; dan sejak Agustus 2026 beredar tulisan komunitas yang mengaitkan mekanisme memori otak lalat dengan sistem memori AI agent. Ada juga temuan ilmiah pendukung pada 2025-2026, seperti laporan Harvard (Juni 2026) bahwa banyak perilaku lalat dikendalikan sirkuit lokal tanpa hub pusat, yang memperkuat narasi arsitektur desentralisasi."),
  h2("3.2 Skala Connectome dalam Perspektif"),
  p("Grafik berikut membandingkan skala empat connectome yang telah diselesaikan penuh. Lonjakan dari larva (3.016 neuron, Science 2023) ke dewasa (139.255 pada FAFB 2024 dan lebih dari 166.000 pada CNS jantan 2026) menunjukkan bahwa komunitas connectomics kini mampu memetakan organisme dewasa penuh secara rutin, dan data tersebut terbuka untuk publik."),
  figure("/home/z/my-project/research/connectome_scale.png", 480),
  caption("Gambar 1: Skala connectome lengkap menurut model organisme (sumber: Science 2023; Janelia 2020; Nature 2024; Janelia/Google 2026)."),
  h2("3.3 Interpretasi: Mengapa Ini Relevan bagi Infrastruktur AI"),
  p("Interpretasi (bukan fakta mentah): daya tarik teknis otak lalat bagi komunitas AI agent ada pada tiga hal. Pertama, skala kecil namun lengkap: 166.000 neuron adalah dataset yang bisa diproses laptop atau GPU tunggal, berbeda dari otak manusia, sehingga menjadi testbed realistis untuk algoritma graf dan memori. Kedua, data terbuka dan tervalidasi manusia: proofreading komunitas FlyWire membuat kualitas graf jauh di atas hasil segmentasi AI mentah. Ketiga, arsitektur biologisnya memberi pola desain memori yang teruji evolusi, khususnya mushroom body sebagai pusat memori asosiatif dengan kode sparse, dan sinyal valence dopaminergik yang menentukan ingatan mana yang layak dikonsolidasi. Ketiga hal inilah yang kami terjemahkan menjadi desain engine memori pada Bab 6."),
];

const bab4 = [
  h1("4. Peta Data dan API Fly Brain"),
  h2("4.1 Lanskap Sumber Data dan Akses Terprogram"),
  p("Tabel berikut merangkum sumber data otak lalat utama beserta jalur aksesnya. Kesimpulan praktisnya: FlyWire/FAFB adalah satu-satunya dataset dewasa lengkap dengan API publik matang (CAVEclient Python) dan UI pencarian (Codex), sehingga menjadi adapter pertama yang masuk akal untuk MCP."),
  tableTitle("Tabel 1: Lanskap data dan API otak lalat"),
  tbl(
    ["Sumber", "Isi", "Akses", "Status"],
    [
      ["FlyWire FAFB (betina, 2024)", "139.255 neuron, >50 juta sinapsis, 8.400 tipe sel", "CAVEclient (Python, token), Codex UI, neuroglancer", "Publik, aktif"],
      ["CNS jantan (Janelia+Google, 2026)", ">166.000 neuron, ±125 juta sinapsis, otak + tali saraf", "Announcement + dataset rilis bertahap; akses programatik diumumkan menyusul", "Baru rilis (3 Sep 2026)"],
      ["Codex (murthylab)", "Explorer connectome: 120K+ neuron proofread, 150K+ anotasi, 30M+ sinapsis", "Web UI + repo GitHub open-source", "Publik, aktif"],
      ["CAVE / CAVEclient", "Materialization, sinapsis, anotasi, versioning", "REST API + Python client; token gratis via portal FlyWire", "Dokumentasi Nature Methods"],
      ["neuPrint (hemibrain Janelia 2020)", "±25.700 neuron otak setengah", "neuprint-python", "Publik, stabil"],
      ["Virtual Fly Brain (VFB)", "Basis pengetahuan anatomi, gambar 3D, ontologi", "API VFB + MCP tool (2026)", "Publik, aktif"],
      ["Connectome larva (Science 2023)", "3.016 neuron lengkap", "Dataset publik", "Publik"],
    ],
    [22, 30, 30, 18]
  ),
  p("Catatan tentang neuron ID yang Anda berikan (root ID 720575940622872870 pada dataset fafb): format tersebut adalah root ID FlyWire, dan URL Codex yang Anda sertakan memakai sintaks filter pencarian milik aplikasi Codex. Identitas biologis neuron tersebut (tipe sel, kelas, posisi) tidak dapat dikonfirmasi dari pencarian web; ia dapat di-resolve secara deterministik melalui CAVEclient setelah token di-set, dan tool flywire_neuron pada MVP kami sudah menyiapkan jalur itu, lengkap dengan URL Codex yang mengarah kembali ke ID tersebut."),
  h2("4.2 Lisensi dan Implikasinya"),
  p("Halaman FlyWire Principles menyatakan versi publikasi data FlyWire dilisensikan CC BY-NC 4.0: atribusi wajib dan penggunaan non-komersial untuk data mentah. Implikasi strategisnya tegas: produk komersial tidak boleh menjual ulang data connectome mentah, tetapi tetap boleh membangun layanan infrastruktur dan tools yang mengakses data tersebut, serta memonetasikan lapisan memori, hosting, dan integrasi yang orisinal. Konfirmasi tertulis ke pemilik data tetap wajib sebelum monetisasi; ini dicatat sebagai risiko terkontrol pada Bab 10."),
];

const bab5 = [
  h1("5. Analisis Calyx (VFB MCP) dan Celah yang Tersisa"),
  h2("5.1 Apa yang Sudah Dilakukan VFB MCP"),
  p("Tool yang Anda temukan sebagai Calyx teridentifikasi sebagai Model Context Protocol tool milik Virtual Fly Brain, diumumkan lewat panduan resmi pada Februari 2026 dan dipromosikan kembali pada Juni 2026. VFB MCP mengintegrasikan basis pengetahuan neuroanatomi VFB (ontologi anatomi, gambar neuron 3D, terminologi tipe sel) dengan LLM seperti Claude, sehingga peneliti dapat bertanya dalam bahasa alami tentang struktur otak lalat. Ini adalah kontribusi nyata dan layak diapresiasi: anatomi kini bisa di-query dari dalam chat LLM."),
  h2("5.2 Celah yang Dibiarkan Terbuka"),
  p("Dari sudut pandang kebutuhan Anda, yaitu infrastruktur universal agar semua agent punya memori dan kesadaran operasional tanpa wiring ulang, ada lima celah yang belum ditutup VFB MCP. Tabel berikut merangkum analisis gap tersebut dan jawaban yang kami rancang pada FlyBrain MCP."),
  tableTitle("Tabel 2: Analisis gap terhadap VFB MCP/Calyx dan posisi FlyBrain MCP"),
  tbl(
    ["Celah", "Kondisi VFB MCP/Calyx", "Jawaban FlyBrain MCP"],
    [
      ["Konektivitas sinaptik", "Fokus anatomi/ontologi, bukan graf sinapsis per neuron", "Tool flywire_connectivity dan flywire_neuron via CAVE"],
      ["Memori persisten", "Tidak ada; tool lookup data saja", "Engine memori episodic/semantic/working + valence"],
      ["Registry multi-agent", "Tidak ada konsep identitas perangkat", "registry_register + awareness_snapshot satu panggilan"],
      ["Distribusi universal", "Terpasang per-klien, orientasi peneliti", "Satu tool-surface: stdio, HTTP, pola bridge perangkat"],
      ["Primitif memori biologis", "Tidak ada", "Asosiasi sparse ala kenyon cell; konsolidasi terencana"],
    ],
    [22, 38, 40]
  ),
  p("Kesimpulan bab: Calyx/VFB MCP bukan kompetitor langsung melainkan pelengkap yang justru membuktikan pasar. Ia melayani pertanyaan anatomi; FlyBrain MCP melayani kebutuhan infrastruktur agent. Keduanya dapat hidup di konfigurasi klien yang sama, dan adapter VFB masuk daftar roadmap v2.0 untuk menyatukan keduanya di bawah satu server."),
];

// ═════════════════════════ KONTEN BAB 6-11 ═════════════════════════
const bab6 = [
  h1("6. Blueprint FlyBrain MCP: Arsitektur Tiga Lapis"),
  h2("6.1 Prinsip Framing yang Jujur"),
  p("Sebelum masuk arsitektur, satu prinsip yang tidak bisa dinegosiasikan: produk ini menyediakan operational awareness dan memori persisten, bukan consciousness biologis. Ketika sebuah drone atau agent dipasangkan, yang terjadi secara konkret adalah ia memuat identitasnya, konteks kerja terakhirnya, dan ingatan relevan dalam satu panggilan, lalu menulis kembali pengalaman barunya agar sesi berikutnya tidak mulai dari nol. Metafora otak lalat dipakai di dua tempat yang jujur: sebagai sumber data nyata yang bisa di-query (connectome) dan sebagai inspirasi desain engine memori. Klaim lebih dari itu akan merusak kredibilitas produk dan berpotensi menipis dari sudut pandang hukum konsumen."),
  h2("6.2 Tiga Lapis Arsitektur"),
  p("Lapis pertama adalah Protocol Layer: satu server MCP yang diekspos dua mode, stdio untuk klien lokal (Claude Desktop, Claude Code, opencode, Cursor, Hermes) dan streamable HTTP untuk hosting terpusat serta bridge perangkat. Karena semua klien berbicara pada tool-surface yang sama, persis seperti yang Anda minta, tidak ada mapping atau wiring ulang: menambahkan agent baru berarti menambahkan satu blok konfigurasi. Lapis kedua adalah Memory and State Layer, engine persisten yang kita sebut Mushroom Body Layer: memori episodic untuk kejadian, semantic untuk fakta terkonsolidasi, working memory untuk konteks aktif, bobot valence sebagai salience, asosiasi sparse antar-ingatan ala kenyon cell, dan satu tool awareness_snapshot sebagai titik masuk menyala. Lapis ketiga adalah Connectome Layer dengan adapter CAVE/FlyWire yang berdegradasi anggun: tanpa token, seluruh tool memori tetap hidup penuh dan tool connectome memberikan pesan perbaikan yang jelas, bukan crash."),
  h2("6.3 Inventaris Tool"),
  tableTitle("Tabel 3: Tool surface FlyBrain MCP (12 tool + 1 resource + 1 prompt)"),
  tbl(
    ["Tool", "Fungsi"],
    [
      ["registry_register", "Daftarkan agent/perangkat: agent, coding-agent, robot, drone, iot, qna-bot"],
      ["memory_write", "Simpan ingatan (episodic/semantic/working) + valence + tags"],
      ["memory_recall", "Tarik ingatan relevan: keyword + recency (half-life 7 hari) + salience"],
      ["memory_associate", "Tautkan dua ingatan (asosiasi sparse ala kenyon cell)"],
      ["context_set / context_get", "Working memory: state kerja aktif per agent"],
      ["awareness_snapshot", "Satu panggilan menyala: identitas + konteks + ingatan teratas"],
      ["flybrain_status", "Status server + petunjuk setup token FlyWire"],
      ["flywire_neuron", "Metadata neuron dari root ID (mis. 720575940622872870)"],
      ["flywire_connectivity", "Partner sinaptik teratas in/out per neuron"],
      ["flywire_search_cell_type", "Cari neuron berdasarkan tipe sel teranotasi"],
      ["flywire_tables", "Inspeksi tabel materialization CAVE"],
      ["Resource: flybrain://agents/{id}/context + Prompt: flybrain_bootstrap", "Konteks langganan + instruksi bootstrap standar untuk agent baru"],
    ],
    [34, 66]
  ),
  h2("6.4 Pola Integrasi"),
  p("Untuk Hermes, opencode, dan klien MCP lain, integrasi berbentuk satu blok konfigurasi (contoh lengkap di Lampiran A). Untuk perangkat non-MCP seperti drone dan sensor IoT, pola yang dijamin adalah device bridge: perangkat atau gateway-nya berbicara REST/MQTT ke bridge, dan bridge memanggil FlyBrain MCP via HTTP dengan agent_id perangkat. Pola ini memindahkan beban protokol dari firmware ke gateway, sehingga perangkat hemat daya tetap mendapat memori dan kesadaran operasional. Untuk agent robotik berbasis ROS 2, node bridge kecil menerjemahkan topik state robot menjadi context_set dan memory_write otomatis."),
];

const bab7 = [
  h1("7. MVP yang Telah Dibangun dan Hasil Uji"),
  h2("7.1 Struktur dan Lingkup MVP"),
  p("Repo flybrain-mcp sudah ada di /home/z/my-project/download/flybrain-mcp dengan struktur siap publikasi: pyproject.toml (paket flybrain-mcp, dependensi inti hanya fastmcp, dependensi opsional caveclient), src/flybrain_mcp (server.py, memory.py, flywire.py), examples (konfigurasi Claude Desktop dan opencode), tests/smoke_test.py, README lengkap, dan .env.example. Engine memori memakai SQLite tanpa dependensi eksternal agar berjalan di mana saja, dengan jalur migrasi ke Postgres + pgvector pada fase hosted."),
  h2("7.2 Hasil Uji yang Terverifikasi"),
  p("Uji dijalankan nyata pada lingkungan kerja ini dengan fastmcp 2.14.3 dan caveclient 8.2.1. Hasilnya: 12 tool terdaftar; registrasi agent hermes-01 berhasil; penulisan ingatan semantic dan episodic berhasil; recall mengembalikan skor benar (ingatan dengan keyword match dan valence positif menang, skor 4,2 melawan 0,85); asosiasi antar-ingatan berhasil; awareness_snapshot mengembalikan identitas, konteks kerja, dan hitungan memori; dan jalur connectome tanpa token menghasilkan pesan auth yang actionable (bukan crash), termasuk konfirmasi bahwa datastack flywire_fafb_production dikenali server CAVE."),
  tableTitle("Tabel 4: Ringkasan hasil smoke test (21 September 2026)"),
  tbl(
    ["Jalur Uji", "Hasil", "Keterangan"],
    [
      ["List tools", "LOLOS", "12 tool terdaftar di server FastMCP"],
      ["Register + write + recall", "LOLOS", "Skoring keyword+recency+valence bekerja (4,2 vs 0,85)"],
      ["Associate", "LOLOS", "Asosiasi sparse tersimpan; penolakan self-link bekerja"],
      ["Context + snapshot", "LOLOS", "Working context dan hitungan memori benar"],
      ["Status + degradation", "LOLOS", "Pesan token actionable; datastack dikenali server CAVE"],
      ["Query connectome nyata", "TERTUNDA", "Menunggu FLYWIRE_TOKEN milik pengguna"],
    ],
    [30, 18, 52]
  ),
];

const bab8 = [
  h1("8. Roadmap Implementasi Bertahap"),
  p("Roadmap disusun agar setiap fase menghasilkan sesuatu yang bisa dipakai, bukan janji. Fase 0 sudah selesai hari ini. Kriteria kelulusan setiap fase ditulis eksplisit agar tidak ada drift cakupan."),
  tableTitle("Tabel 5: Roadmap fase dan kriteria kelulusan"),
  tbl(
    ["Fase", "Lingkup", "Kriteria Kelulusan"],
    [
      ["v0.1 lokal (selesai)", "Server stdio+HTTP, memori SQLite, adapter FlyWire, konfigurasi klien", "Smoke test lolos penuh (tercapai)"],
      ["v1.0 hosted (4-6 minggu)", "Multi-tenant Postgres+pgvector, API key, rate limit, dashboard memori", "2 klien eksternal (Hermes, opencode) aktif 7 hari tanpa wiring ulang"],
      ["v1.5 device bridge (8-12 minggu)", "Bridge REST/MQTT ke MCP, SDK Python/JS, node ROS 2", "1 drone/robot demo: matikan-nyalakan, konteks bertahan"],
      ["v2.0 memori cerdas", "Konsolidasi episodic ke semantic otomatis, adapter neuPrint/VFB/male-CNS, instinct packs robot", "Konsolidasi tervalidasi pada 1.000 ingatan uji"],
    ],
    [22, 42, 36]
  ),
];

const bab9 = [
  h1("9. Strategi SaaS: FlyBrain-as-a-Service"),
  h2("9.1 Positioning dan Kompetisi"),
  p("Pasar memori agent sudah tervalidasi: mem0 menawarkan memori hosted via MCP, memnode menjual memori jangka panjang sebagai API hosted, Anthropic meluncurkan persistent memory untuk Claude Managed Agents, dan direktori seperti glama.ai mencatat puluhan server memori komunitas. Artinya kebutuhan sudah terbukti, dan pembedaan menjadi kunci. FlyBrain MCP membedakan diri lewat tiga lapis yang tidak dimiliki kompetitor generik: integrasi data connectome nyata sebagai aset riset dan cerita merek, primitif memori terinspirasi neurobiologi (valence, asosiasi sparse, konsolidasi), dan fokus vertikal robotik/IoT yang membutuhkan bridge perangkat, bukan hanya chatbot."),
  h2("9.2 Model Bisnis dan Tier Harga"),
  p("Model yang dipilih adalah open-core: inti server tetap open-source demi adopsi dan distribusi via registry MCP, sementara hosting multi-tenant, memori jangka panjang berskala besar, dashboard, dan fitur tim berbayar. Angka di bawah adalah kerangka awal berbasis norma pasar kategori ini, bukan komitmen harga."),
  tableTitle("Tabel 6: Kerangka tier harga (asumsi pasar, per September 2026)"),
  tbl(
    ["Tier", "Harga Indikatif", "Cakupan"],
    [
      ["Free / Community", "USD 0", "Self-host, 1 agent, memori lokal, seluruh tool inti"],
      ["Pro", "USD 19-29/bulan", "10 agent, hosted MCP + memori 1 GB, 10.000 panggilan/hari"],
      ["Team", "USD 99/bulan", "Memori bersama antar-agent, RBAC, audit log, webhook"],
      ["Enterprise", "Kontrak", "Self-host lisensi, SLA, impor data privat, dukungan integrasi robotik"],
    ],
    [22, 22, 56]
  ),
  h2("9.3 Go-to-Market dan Moat"),
  p("GTM memanfaatkan momentum: publikasi repo open-source saat wacana otak lalat masih panas (WIRED 16 September 2026 baru lima hari lalu), pendaftaran ke registry MCP resmi dan direktori komunitas, konten teknis bertajuk memori ala mushroom body untuk AI agent, dan penawaran terarah ke tim robotik/drone yang membutuhkan memori lintas-sesi. Moat jangka menengah ada pada kualitas engine memori (konsolidasi otomatis yang benar-benar menurunkan token dan kesalahan agent), jejak ekosistem (instinct packs dan template bridge yang membuat migrasi mahal), dan posisi sebagai standar de-facto memori untuk perangkat fisik, sebuah niche yang belum dipegang pemain mana pun."),
];

const bab10 = [
  h1("10. Analisis Risiko dan Mitigasi"),
  p("Risiko terbesar bukan teknis melainkan legal dan naratif, dan keduanya sudah punya jalur mitigasi yang jelas. Tabel berikut meringkas enam risiko utama beserta mitigasinya."),
  tableTitle("Tabel 7: Register risiko utama"),
  tbl(
    ["Risiko", "Tingkat", "Mitigasi"],
    [
      ["Lisensi data FlyWire CC BY-NC 4.0 membatasi penggunaan komersial data mentah", "Tinggi", "Monetisasi infrastruktur/tools, bukan data; atribusi penuh; konfirmasi tertulis ke pemilik data sebelum monetisasi"],
      ["Klaim consciousness dianggap menyesatkan", "Tinggi", "Framing terkunci: operational awareness + memory; disclaimers di README dan materi marketing"],
      ["Ketergantungan API eksternal (CAVE dapat berubah skema/versi)", "Menengah", "Adapter terisolasi + graceful degradation + tool flywire_tables untuk inspeksi; cache data yang diizinkan"],
      ["Kompetitor memori besar (mem0, platform vendor) melajukan fitur serupa", "Menengah", "Fokus vertikal robotik/IoT, primitif neurobiologis, kecepatan rilis open-core"],
      ["Keamanan memori lintas-agent (kontaminasi ingatan antar penyewa)", "Menengah", "Isolasi per agent_id + tenant, audit log, uji penetrasi sebelum v1.0"],
      ["Perubahan skema materialization CAVE antar versi (630/1300) merusak query", "Rendah", "Pin versi materialization, uji regresi adapter, dokumentasi eksplisit"],
    ],
    [40, 12, 48]
  ),
];

const bab11 = [
  h1("11. Kesimpulan dan Langkah Berikutnya"),
  p("Kesimpulan: peluang tersebut nyata, berjalan di atas data publik yang sah, dan jendela waktunya sedang terbuka lebar. Calyx/VFB MCP membuktikan minat pasar tetapi hanya menyentuh anatomi; kebutuhan Anda akan infrastruktur memori universal untuk agent dan perangkat justru berada di celah yang masih kosong. MVP yang sudah diuji menunjukkan kelayakan teknis dengan risiko teknis yang rendah; risiko utama ada pada kepatuhan lisensi dan disiplin framing, keduanya terkontrol."),
  p("Langkah berikutnya dalam urutan eksekusi: pertama, buat token gratis di portal FlyWire dan jalankan tool flywire_neuron untuk root ID 720575940622872870 sekaligus memverifikasi seluruh jalur connectome end-to-end; kedua, pasang FlyBrain MCP ke Hermes dan satu coding agent (opencode atau Claude Code) memakai konfigurasi di Lampiran A, lalu biarkan berjalan seminggu untuk mengukur nilai memori nyata; ketiga, publikasikan repo ke GitHub dan daftarkan ke registry MCP; keempat, mulai validasi lisensi dengan pemilik data FlyWire sebelum membangun lapisan hosting berbayar; kelima, pilih satu perangkat fisik (drone atau robot) sebagai demo bridge untuk fase v1.5."),
];

// ═════════════════════════ LAMPIRAN ═════════════════════════
const lampiran = [
  h1("Lampiran A: Konfigurasi Integrasi"),
  p("Tiga pola konfigurasi berikut sudah disiapkan sebagai file di repo (folder examples). Salin sesuai klien yang dipakai. Untuk Hermes, gunakan pola generik MCP client di bawah; jika Hermes memakai klien MCP dengan skema berbeda, hanya nama field yang perlu disesuaikan, tool-surface tetap identik."),
  tableTitle("Konfigurasi Claude Desktop (claude_desktop_config.json)"),
  ...code([
    "{",
    "  \"mcpServers\": {",
    "    \"flybrain\": {",
    "      \"command\": \"python\",",
    "      \"args\": [\"-m\", \"flybrain_mcp.server\"],",
    "      \"env\": { \"FLYWIRE_TOKEN\": \"<opsional>\" }",
    "    }",
    "  }",
    "}",
  ]),
  tableTitle("Konfigurasi opencode (opencode.json)"),
  ...code([
    "{",
    "  \"$schema\": \"https://opencode.ai/config.json\",",
    "  \"mcp\": {",
    "    \"flybrain\": {",
    "      \"type\": \"local\",",
    "      \"command\": [\"python\", \"-m\", \"flybrain_mcp.server\"],",
    "      \"enabled\": true,",
    "      \"environment\": { \"FLYWIRE_TOKEN\": \"<opsional>\" }",
    "    }",
    "  }",
    "}",
  ]),
  tableTitle("Pola hosted / device bridge (Hermes, IoT, drone, robot)"),
  ...code([
    "flybrain-mcp --http --port 8000",
    "# Semua klien & bridge menunjuk ke: http://127.0.0.1:8000/mcp",
    "# Perangkat non-MCP: gateway REST/MQTT -> panggil tool via HTTP",
    "# dengan agent_id unik per perangkat, lalu panggil",
    "# awareness_snapshot(agent_id) saat perangkat menyala.",
  ]),
  h1("Lampiran B: Daftar Sumber Riset"),
  p("Semua sumber diakses pada 21 September 2026. Sumber primer ditempatkan lebih tinggi dari liputan media dan tulisan komunitas.", { size: 21 }),
  refItem("1. FlyWire (flywire.ai) dan flywire.ai/apps - Connectome FAFB, Codex Connectome Data Explorer, jumlah neuron proofread dan anotasi."),
  refItem("2. Blog Google (blog.google) dan research.google, 3 September 2026 - Mapping the complete male fruit fly brain; lebih dari 166.000 neuron, otak plus tali saraf ventral."),
  refItem("3. HHMI News (hhmi.org), 3 September 2026 - Scientists Complete Full Map of the Fruit Fly Central Nervous System (laki-laki)."),
  refItem("4. Nature (2024), Dorkenwald et al. dan Schlegel et al. - Neuronal wiring diagram of an adult brain; whole-brain annotation dan cell typing (139.255 neuron, 8.400 tipe sel)."),
  refItem("5. NIMH/Princeton/Harvard News (2024 dan 2026) - liputan connectome FAFB dan temuan sirkuit lokal."),
  refItem("6. CAVEconnectome/CAVEclient (GitHub) dan Dorkenwald et al., Nature Methods - CAVE: Connectome Annotation Versioning Engine; API programatik FlyWire."),
  refItem("7. murthylab/codex (GitHub) - Codex: Connectome Data Explorer, open-source."),
  refItem("8. WIRED, 16 September 2026 - I Trained a Fly Brain to Generate WIRED Story Ideas (PitchFly)."),
  refItem("9. MindStudio, 14 September 2026 - Fruit Fly Brain Uploaded to AI: hobiis melatih connectome untuk sortir surel dan gim."),
  refItem("10. Virtual Fly Brain (virtualflybrain.org), panduan Februari 2026 dan pengumuman Juni 2026 - VFB Model Context Protocol (MCP) Tool; mcpmarket.com, Agustus 2026."),
  refItem("11. edit.flywire.ai - FlyWire Principles: data publikasi dilisensikan CC BY-NC 4.0."),
  refItem("12. Janelia (janelia.org) - Learning and memory: the Mushroom Body; Parnas et al. 2024 (review memori mushroom body); Aso et al. 2014 (MBON valence)."),
  refItem("13. opencode.ai/docs/mcp-servers dan /docs/config - dukungan MCP server di opencode."),
  refItem("14. Anthropic, 25 November 2024 - Introducing the Model Context Protocol; cloud.google.com - panduan MCP."),
  refItem("15. mem0.ai, memnode (mcpservers.org), glama.ai, newamerica.org - lanskap memori agent SaaS dan catatan keamanan memori MCP."),
  refItem("16. Stanford Report, 26 November 2025 - Scientists successfully rewire a fruit fly brain (konteks ilmiah 2025-2026)."),
];

// ═════════════════════════ PERAKITAN DOKUMEN ═════════════════════════
const coverConfig = {
  title: "FlyBrain MCP: Riset dan Blueprint Infrastruktur Otak Universal",
  subtitle: "Dari connectome viral ke lapisan memori universal untuk AI agent, robotik, dan IoT",
  englishLabel: "RESEARCH AND BUILD DOSSIER",
  metaLines: [
    "Mode: riset otonom - riset pasar, arsitektur MCP, strategi SaaS",
    "Tanggal: 21 September 2026",
    "Status MVP: telah dibangun dan teruji (repo flybrain-mcp)",
    "Klasifikasi: dokumen kerja internal",
  ],
  footerLeft: "FlyBrain MCP - internal working document",
  footerRight: "September 2026",
  palette: P,
};

const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

function pageNumFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: FONT_BODY })],
    })],
  });
}
function titleHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.innerLine, space: 4 } },
      children: [new TextRun({ text: "FlyBrain MCP - Riset dan Blueprint Infrastruktur Otak Universal", size: 18, color: "808080", font: FONT_BODY })],
    })],
  });
}

// Front matter: judul TOC (TANPA heading style) + TableOfContents + hint + PageBreak
const frontMatter = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360 },
    children: [new TextRun({ text: "DAFTAR ISI", bold: true, size: 32, font: FONT_HEAD, color: P.headingColor })],
  }),
  new TableOfContents("Daftar Isi", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({
      text: "Catatan: Daftar isi ini dibuat dengan field code. Agar nomor halaman akurat setelah penyuntingan, klik kanan daftar isi lalu pilih Update Field.",
      italics: true, size: 18, color: "888888", font: FONT_BODY,
    })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

const bodyChildren = [
  ...bab1, ...bab2, ...bab3, ...bab4, ...bab5,
  ...bab6, ...bab7, ...bab8, ...bab9, ...bab10, ...bab11,
  ...lampiran,
];

const doc = new Document({
  creator: "FlyBrain MCP Research",
  title: "FlyBrain MCP: Riset dan Blueprint Infrastruktur Otak Universal",
  styles: {
    default: {
      document: {
        run: { font: FONT_BODY, size: 24, color: P.body },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: FONT_HEAD, size: 32, bold: true, color: P.headingColor },
        paragraph: { spacing: { before: 360, after: 160, line: 312 } },
      },
      heading2: {
        run: { font: FONT_HEAD, size: 30, bold: true, color: P.headingColor },
        paragraph: { spacing: { before: 240, after: 120, line: 312 } },
      },
      heading3: {
        run: { font: FONT_HEAD, size: 28, bold: true, color: P.headingColor },
        paragraph: { spacing: { before: 200, after: 100, line: 312 } },
      },
    },
  },
  sections: [
    { // Section 1: Cover - margin 0, tanpa nomor halaman
      properties: {
        page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: buildCoverR1(coverConfig),
    },
    { // Section 2: Front matter (TOC) - Roman
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageNumFooter() },
      children: frontMatter,
    },
    { // Section 3: Body - Arabic mulai 1
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: titleHeader() },
      footers: { default: pageNumFooter() },
      children: bodyChildren,
    },
  ],
});

const OUT = "/home/z/my-project/download/FlyBrain_MCP_Riset_dan_Blueprint.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("OK ->", OUT, buf.length, "bytes");
});
