# 4-a — full-stack-developer — v1.2 "PLANET" (12_ECOSYSTEM.md)

## Ringkasan
Membangun v1.2 PLANET: semua fitur FLYBRAIN OS ter-wire ke satu dunia hidup (8 biome + iklim data-nyata + jaring makanan) tanpa merusak v1.1. Zero-storage tetap: state dunia hanya di IndexedDB user (settings "organism.world", debounce 1,5 dtk); server tetap amnesia.

## File dibuat
- src/lib/flybrain/ecosystem/types.ts — BiomeId(8), ClimateState, BiomeState, CreatureWorldState, WorldState, WorldSignals
- src/lib/flybrain/ecosystem/world.ts — BIOMES, WIRE_TABLE (8/8), produceFor (sinyal nyata), worldTick (murni), worldSnapshot, initialWorld, isWorldState
- src/lib/flybrain/ecosystem/climate.ts — 12 denyut=1 hari; cuaca dari error ratio 20 denyut; musim dari verdict reflect; angin; nol Math.random
- src/lib/flybrain/ecosystem/motion.ts — HOME_BIOME/SUITABLE/VISIT, migrasi subur, mood, target deterministik (hash FNV-1a), grazingDrain
- src/components/flybrain/views/PlanetView.tsx — RAF tunggal (pause visibilitychange, cleanup), langit konnektom (buildAtlas), 7 blob biome + band langit, partikel cuaca, tint lerp, sprite overlay lerp, inspektor biome/creature, panel IKLIM/JARING MAKANAN/PETA SISTEM

## File diubah
- src/lib/flybrain/store.ts — slice world + recordWorldTick + persist debounce + load di init + reset di wipe + ViewKey "planet" (+export FlybrainState)
- src/lib/flybrain/organism/engine.ts — worldSignalsFromState() + worldTick() setelah quant tick, sebelum self-reflect (try/catch → eventBus refleks)
- src/components/flybrain/AppShell.tsx — nav 08 Planet (Globe2), ticker/footer v1.2 "PLANET"
- src/app/api/mcp/route.ts — tool ke-9 world.map (stateless: wire table + rumus iklim + cara baca peta)
- download/flybrain-os/09_CHANGELOG.md (v1.2.0 di atas), 00_README.md (v1.2 + 9 tools), 08_PROJECT_CONTEXT.md (fase v1.2 + keputusan PLANET)

## Bukti verifikasi
- `bun run lint` BERSIH (0 error, 0 warning)
- curl initialize 200; tools/list = 9 tool (termasuk world.map); tools/call world.map HTTP 200 (ok, wire_table 8, rumus_iklim 4); -32602 invalid params tetap
- GET / = 200; dev.log tanpa error compile baru (entri "Parsing ecmascript" di log = LAMA, sebelum fix factory.ts sesi 3; factory.ts:147 kini benar)
- Test logika murni (bun): determinisme iklim, wire 8/8, rumah creature benar, kelaparan → produksi ~0 + migrasi + trail tumbuh
- agent-browser: nav 08 render; denyut dunia 0→15; klik creature/biome/wire-row OK; 5 denyut manual → creature lintas biome (migrasi + mood); console errors kosong; screenshot tool-results/planet-01..03.png

## Catatan untuk agent berikutnya
- EventLog store hanya kejadian bus biosfer; sinyal gerbang diambil dari stats.counts.gateway_log (delta) — lihat produceFor "samudra".
- Kanvas RAF hanya di PlanetView; jangan tambah RAF lain (konstitusi hukum 6).
- worldTick TIDAK boleh fetch/LLM; sinyal dunia dari worldSignalsFromState (engine.ts).
- Musim sebelum self-reflect pertama = "kemarau" (netral, bukan random).
