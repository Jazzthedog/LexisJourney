import Phaser from "phaser";

// PROMPTS P4.3's "5 parallax background layers" + SPEC §4's "4-6 parallax
// depths; foreground silhouettes occasionally occlude the play layer."
// Four receding background bands (ridge -> far trees -> mid trees -> near
// scrub, each closer/darker/faster than the last) plus one foreground band
// of large trunks that pass *in front of* gameplay — Limbo's misdirection
// trick, not just atmosphere.
//
// The four background bands are screen-fixed TileSprites (scrollFactor 0,
// repositioned to camera-center every frame — same technique as Fog.ts)
// whose `tilePositionX` is driven by camera.scrollX * a per-layer factor;
// this guarantees full coverage regardless of a map's width without having
// to know it ahead of time. The foreground trunks are real world-positioned
// objects using Phaser's native scrollFactor > 1 (closer-than-camera
// parallax) instead, since discrete world-placed props don't have the
// coverage problem a tiling background band does.

interface BandConfig {
  key: string;
  height: number; // px, silhouette band height within its texture
  alpha: number;
  scrollFactor: number; // 0..1, how much of camera.scrollX this band tracks
  driftPxPerSec: number; // slow autonomous drift, independent of camera
  depth: number;
  color: number;
}

const TEXTURE_WIDTH = 512;

// Atmospheric perspective: the farthest band is the *lightest* grey (reads
// as hazy/receding) and each closer band gets darker, ending near-black —
// the same value range as the foreground gameplay silhouettes — so the
// nearest band blends into "the world" rather than floating as a visibly
// separate lighter strip in front of it. A first pass at uniform near-black
// for every band was nearly invisible against the also-near-black
// background (confirmed via a renderer screenshot, not assumed) — the
// lightness gradient is what actually makes the depth read.
const BANDS: BandConfig[] = [
  { key: "fx-parallax-ridge", height: 90, alpha: 0.55, scrollFactor: 0.08, driftPxPerSec: 1, depth: -50, color: 0x2e2e2e },
  { key: "fx-parallax-fartrees", height: 130, alpha: 0.6, scrollFactor: 0.22, driftPxPerSec: 2, depth: -40, color: 0x232323 },
  { key: "fx-parallax-midtrees", height: 190, alpha: 0.75, scrollFactor: 0.48, driftPxPerSec: 3, depth: -30, color: 0x161616 },
  { key: "fx-parallax-scrub", height: 70, alpha: 0.85, scrollFactor: 0.72, driftPxPerSec: 4, depth: -20, color: 0x0c0c0c },
];

const FOREGROUND_TRUNK_SPACING_PX = 520;
const FOREGROUND_TRUNK_SCROLL_FACTOR = 1.18; // >1: closer than the camera plane
const FOREGROUND_DEPTH = 40; // above gameplay (0), below fog (50+)

function drawWrapping(width: number, draw: (offsetX: number) => void): void {
  // Draw once at the true position and once shifted by ±width so any shape
  // straddling an edge still tiles seamlessly when the texture repeats.
  draw(0);
  draw(-width);
  draw(width);
}

function buildRidgeTexture(scene: Phaser.Scene, cfg: BandConfig): void {
  if (scene.textures.exists(cfg.key)) {
    return;
  }
  const canvasTexture = scene.textures.createCanvas(cfg.key, TEXTURE_WIDTH, cfg.height);
  if (!canvasTexture) {
    throw new Error(`Parallax: failed to create texture "${cfg.key}"`);
  }
  const ctx = canvasTexture.getContext();
  ctx.fillStyle = Phaser.Display.Color.IntegerToColor(cfg.color).rgba;

  // A gently undulating horizon — two full sine periods across the texture
  // width, so it wraps perfectly with no seam-matching trick needed.
  ctx.beginPath();
  ctx.moveTo(0, cfg.height);
  const baseline = cfg.height * 0.55;
  const amplitude = cfg.height * 0.3;
  for (let x = 0; x <= TEXTURE_WIDTH; x += 4) {
    const y = baseline - Math.sin((x / TEXTURE_WIDTH) * Math.PI * 2) * amplitude - Math.sin((x / TEXTURE_WIDTH) * Math.PI * 6) * amplitude * 0.25;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(TEXTURE_WIDTH, cfg.height);
  ctx.closePath();
  ctx.fill();

  canvasTexture.refresh();
}

function buildTreelineTexture(scene: Phaser.Scene, cfg: BandConfig, treeCount: number, trunkWidthRatio: number): void {
  if (scene.textures.exists(cfg.key)) {
    return;
  }
  const canvasTexture = scene.textures.createCanvas(cfg.key, TEXTURE_WIDTH, cfg.height);
  if (!canvasTexture) {
    throw new Error(`Parallax: failed to create texture "${cfg.key}"`);
  }
  const ctx = canvasTexture.getContext();
  ctx.fillStyle = Phaser.Display.Color.IntegerToColor(cfg.color).rgba;

  // Deterministic pseudo-random spacing (a fixed seed table, not Math.random)
  // so the same texture is produced every time this scene builds — no
  // Date.now()/Math.random() surprises under repeated verification.
  for (let i = 0; i < treeCount; i++) {
    const seed = Math.sin(i * 12.9898) * 43758.5453;
    const jitter = seed - Math.floor(seed);
    const x = (i / treeCount) * TEXTURE_WIDTH + jitter * (TEXTURE_WIDTH / treeCount) * 0.6;
    const h = cfg.height * (0.55 + jitter * 0.45);
    const w = cfg.height * trunkWidthRatio * (0.7 + jitter * 0.6);

    drawWrapping(TEXTURE_WIDTH, (offsetX) => {
      const drawX = x + offsetX;
      ctx.beginPath();
      ctx.moveTo(drawX - w / 2, cfg.height);
      ctx.lineTo(drawX, cfg.height - h);
      ctx.lineTo(drawX + w / 2, cfg.height);
      ctx.closePath();
      ctx.fill();
      // A short trunk stub, so it doesn't read as a single floating triangle.
      ctx.fillRect(drawX - w * 0.12, cfg.height - h * 0.15, w * 0.24, h * 0.15);
    });
  }

  canvasTexture.refresh();
}

function buildScrubTexture(scene: Phaser.Scene, cfg: BandConfig): void {
  if (scene.textures.exists(cfg.key)) {
    return;
  }
  const canvasTexture = scene.textures.createCanvas(cfg.key, TEXTURE_WIDTH, cfg.height);
  if (!canvasTexture) {
    throw new Error(`Parallax: failed to create texture "${cfg.key}"`);
  }
  const ctx = canvasTexture.getContext();
  ctx.fillStyle = Phaser.Display.Color.IntegerToColor(cfg.color).rgba;

  const bumpCount = 14;
  for (let i = 0; i < bumpCount; i++) {
    const seed = Math.sin(i * 78.233) * 12345.6789;
    const jitter = seed - Math.floor(seed);
    const x = (i / bumpCount) * TEXTURE_WIDTH + jitter * (TEXTURE_WIDTH / bumpCount) * 0.7;
    const r = cfg.height * (0.3 + jitter * 0.5);

    drawWrapping(TEXTURE_WIDTH, (offsetX) => {
      ctx.beginPath();
      ctx.ellipse(x + offsetX, cfg.height, r, r * 0.7, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    });
  }

  canvasTexture.refresh();
}

function buildTrunkTexture(scene: Phaser.Scene): string {
  const key = "fx-parallax-trunk";
  if (scene.textures.exists(key)) {
    return key;
  }
  const w = 90;
  const h = 720;
  const canvasTexture = scene.textures.createCanvas(key, w, h);
  if (!canvasTexture) {
    throw new Error("Parallax: failed to create foreground trunk texture");
  }
  const ctx = canvasTexture.getContext();
  ctx.fillStyle = "#020202";
  // A tapered trunk, off-center, tall enough to run off both top and bottom
  // of any Chapter 1 map's viewport — reads as "close enough to occlude,"
  // not a discrete prop the player is meant to notice individually.
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h);
  ctx.lineTo(w * 0.35, 0);
  ctx.lineTo(w * 0.55, 0);
  ctx.lineTo(w * 0.75, h);
  ctx.closePath();
  ctx.fill();
  canvasTexture.refresh();
  return key;
}

export class ParallaxLayers {
  private readonly bands: { sprite: Phaser.GameObjects.TileSprite; cfg: BandConfig }[] = [];
  private readonly trunks: Phaser.GameObjects.Image[] = [];
  private readonly driftAccum = new Map<string, number>();

  constructor(scene: Phaser.Scene, width: number, height: number, levelWidthPx: number, levelHeightPx: number) {
    buildRidgeTexture(scene, BANDS[0]);
    buildTreelineTexture(scene, BANDS[1], 6, 0.7);
    buildTreelineTexture(scene, BANDS[2], 5, 1.0);
    buildScrubTexture(scene, BANDS[3]);
    const trunkKey = buildTrunkTexture(scene);

    for (const cfg of BANDS) {
      const sprite = scene.add.tileSprite(width / 2, height - cfg.height / 2, width, cfg.height, cfg.key);
      sprite.setAlpha(cfg.alpha);
      sprite.setScrollFactor(0);
      sprite.setDepth(cfg.depth);
      this.bands.push({ sprite, cfg });
    }

    // Sized to the map's own height (not just the viewport) with margin,
    // since a trunk anchored in world space needs to fully cover a tall map
    // (ch1_03_stream's river room) even before any vertical scroll parallax
    // mismatch is accounted for. Y keeps the normal scroll factor (1) —
    // only X gets the closer-than-camera treatment, the standard
    // side-scroller convention (vertical camera travel here is modest).
    const trunkCount = Math.max(1, Math.ceil(levelWidthPx / FOREGROUND_TRUNK_SPACING_PX));
    for (let i = 0; i < trunkCount; i++) {
      const x = i * FOREGROUND_TRUNK_SPACING_PX + FOREGROUND_TRUNK_SPACING_PX * 0.5;
      const trunk = scene.add.image(x, levelHeightPx / 2, trunkKey);
      trunk.setDisplaySize(90, levelHeightPx + 200);
      trunk.setScrollFactor(FOREGROUND_TRUNK_SCROLL_FACTOR, 1);
      trunk.setDepth(FOREGROUND_DEPTH);
      trunk.setAlpha(0.97);
      this.trunks.push(trunk);
    }
  }

  update(deltaSeconds: number, cameraScrollX: number): void {
    for (const { sprite, cfg } of this.bands) {
      sprite.tilePositionX = cameraScrollX * cfg.scrollFactor + this.driftFor(cfg, deltaSeconds);
    }
  }

  private driftFor(cfg: BandConfig, deltaSeconds: number): number {
    const prev = this.driftAccum.get(cfg.key) ?? 0;
    const next = prev + cfg.driftPxPerSec * deltaSeconds;
    this.driftAccum.set(cfg.key, next);
    return next;
  }
}
