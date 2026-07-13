import Phaser from "phaser";

interface FogLayerConfig {
  alpha: number;
  driftSpeed: number;
  tileScale: number;
}

const LAYER_CONFIGS: FogLayerConfig[] = [
  { alpha: 0.04, driftSpeed: 4, tileScale: 1.6 },
  { alpha: 0.07, driftSpeed: 9, tileScale: 1.1 },
  { alpha: 0.1, driftSpeed: 16, tileScale: 0.75 },
];

const FOG_TEXTURE_KEY = "fx-fog-blob";

function ensureFogTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(FOG_TEXTURE_KEY)) {
    return FOG_TEXTURE_KEY;
  }

  const size = 512;
  const canvasTexture = scene.textures.createCanvas(FOG_TEXTURE_KEY, size, size);
  if (!canvasTexture) {
    throw new Error("Failed to create fog texture canvas");
  }
  const ctx = canvasTexture.getContext();

  // Soft overlapping blobs make a tileable-enough cloud texture without any
  // art assets — good enough for a slowly drifting background layer.
  const blobs: Array<[number, number, number]> = [
    [0.3, 0.5, 0.35],
    [0.65, 0.4, 0.3],
    [0.5, 0.72, 0.28],
    [0.85, 0.58, 0.22],
  ];

  for (const [bx, by, br] of blobs) {
    const cx = bx * size;
    const cy = by * size;
    const r = br * size;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  canvasTexture.refresh();
  return FOG_TEXTURE_KEY;
}

export class FogLayers {
  private layers: Phaser.GameObjects.TileSprite[] = [];
  private driftSpeeds: number[] = [];

  // `densityMultiplier` scales every layer's base alpha (PROMPTS P4.3's
  // per-map fog density) — 1 keeps the original P0.2 look, <1 thins it out,
  // >1 thickens it (see fx/Palette.ts's per-map presets).
  constructor(scene: Phaser.Scene, width: number, height: number, densityMultiplier = 1) {
    const key = ensureFogTexture(scene);

    LAYER_CONFIGS.forEach((cfg, i) => {
      const layer = scene.add.tileSprite(width / 2, height / 2, width, height, key);
      layer.setAlpha(Phaser.Math.Clamp(cfg.alpha * densityMultiplier, 0, 1));
      layer.setTint(0x777777);
      layer.setScrollFactor(0);
      layer.setDepth(50 + i);
      layer.tileScaleX = cfg.tileScale;
      layer.tileScaleY = cfg.tileScale;
      this.layers.push(layer);
      this.driftSpeeds.push(cfg.driftSpeed);
    });
  }

  update(deltaSeconds: number): void {
    this.layers.forEach((layer, i) => {
      layer.tilePositionX += this.driftSpeeds[i] * deltaSeconds;
    });
  }

  // PROMPTS P5.1's "grain/fog auto-degrade if not [holding a stable
  // framerate]" — a hard on/off rather than a subtler alpha fade, since the
  // actual performance win is skipping the draw calls entirely, not just
  // making them fainter.
  setEnabled(enabled: boolean): void {
    for (const layer of this.layers) {
      layer.setVisible(enabled);
    }
  }
}
