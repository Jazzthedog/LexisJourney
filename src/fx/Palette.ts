// Per-map atmosphere (PROMPTS P4.3): "as the game progresses, ambient light
// rises chapter by chapter" (SPEC §4) — within Chapter 1 itself the light
// stays in the same dusk-woods register, but each map gets a small,
// deliberate variance (the owl's territory reads tenser/darker, the stream
// crossing reads mistier, the highway finish reads a touch brighter,
// foreshadowing progress). Keyed by mapKey rather than a Tiled map property
// so a new map just needs an entry here — no .tmj regen required to tune it.
export interface PalettePreset {
  backgroundColor: number; // camera clear color
  ambientDarkness: number; // 0 (bright) .. 1 (near-black) — overlay alpha
  fogDensity: number; // multiplier on FogLayers' base per-layer alpha
}

// Kept deliberately subtle: GrainPipeline's shader vignette (fx/Grain.ts)
// already darkens the frame edges on every map regardless of this overlay,
// so ambientDarkness only needs to nudge the *center* of the screen — a
// value much above ~0.15 stacks with the vignette + fog bands enough to
// crush the tileset/decoration detail underneath it. Verified visually via
// a Phaser renderer screenshot at these numbers, not just by reading them.
const DEFAULT_PALETTE: PalettePreset = {
  backgroundColor: 0x0d0d0d,
  ambientDarkness: 0.08,
  fogDensity: 1,
};

const CHAPTER_1_PALETTES: Record<string, PalettePreset> = {
  ch1_01_reststop: { backgroundColor: 0x100e0d, ambientDarkness: 0.04, fogDensity: 0.8 },
  ch1_02_woods: { backgroundColor: 0x0c0c0b, ambientDarkness: 0.1, fogDensity: 1.0 },
  ch1_03_stream: { backgroundColor: 0x0b0d0e, ambientDarkness: 0.07, fogDensity: 1.3 },
  ch1_04_owl: { backgroundColor: 0x08080a, ambientDarkness: 0.15, fogDensity: 1.1 },
  ch1_05_highway: { backgroundColor: 0x110f0d, ambientDarkness: 0.05, fogDensity: 0.9 },
};

export function getPalette(mapKey: string): PalettePreset {
  return CHAPTER_1_PALETTES[mapKey] ?? DEFAULT_PALETTE;
}
