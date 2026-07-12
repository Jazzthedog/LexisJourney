import Phaser from "phaser";

interface FogLayerConfig {
  alpha: number;
  driftSpeed: number;
  tileScale: number;
}

const LAYER_CONFIGS: FogLayerConfig[] = [
  { alpha: 0.08, driftSpeed: 4, tileScale: 1.6 },
  { alpha: 0.14, driftSpeed: 9, tileScale: 1.1 },
  { alpha: 0.2, driftSpeed: 16, tileScale: 0.75 },
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

  constructor(scene: Phaser.Scene, width: number, height: number) {
    const key = ensureFogTexture(scene);

    LAYER_CONFIGS.forEach((cfg, i) => {
      const layer = scene.add.tileSprite(width / 2, height / 2, width, height, key);
      layer.setAlpha(cfg.alpha);
      layer.setTint(0xaaaaaa);
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
}
