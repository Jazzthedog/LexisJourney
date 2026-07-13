import Phaser from "phaser";

const WISPS_PER_PATH = 4;
const WISP_SPEED = 60; // px/s along the path
const WISP_COLOR = 0xbfe6ff;
const BASE_WISP_RADIUS = 5;
const BASE_WISP_ALPHA = 0.85;
// SPEC §1 rule 1 ("pulse, not a lens"): wisps linger after release rather
// than snapping off, so sniffing reads as a periodic check, not a filter
// you play inside.
const BASE_LINGER_MS = 2500;
const DARKEN_ALPHA = 0.35;
const OVERLAY_DEPTH = 40;
const WISP_DEPTH = 41;

// SPEC §2: each collected Memory Token "permanently strengthens Lexi's
// nose" — wisps render brighter, reach farther (bigger, more visible from a
// distance), and linger longer. Deliberately unbounded except alpha (which
// clamps at fully opaque); the exact per-token increments are a feel knob,
// not a hard spec number.
const RADIUS_PER_TOKEN = 1.5;
const ALPHA_PER_TOKEN = 0.03;
const LINGER_PER_TOKEN_MS = 400;

export interface ScentPoint {
  x: number;
  y: number;
}

interface ScentPath {
  points: ScentPoint[];
  segmentLengths: number[];
  totalLength: number;
}

function buildPath(points: ScentPoint[]): ScentPath {
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const length = Phaser.Math.Distance.Between(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    segmentLengths.push(length);
    totalLength += length;
  }
  return { points, segmentLengths, totalLength };
}

function pointAlongPath(path: ScentPath, t: number): ScentPoint {
  let distance = Phaser.Math.Clamp(t, 0, 1) * path.totalLength;

  for (let i = 0; i < path.segmentLengths.length; i++) {
    const segmentLength = path.segmentLengths[i];
    if (distance <= segmentLength || i === path.segmentLengths.length - 1) {
      const segmentT = segmentLength > 0 ? distance / segmentLength : 0;
      const a = path.points[i];
      const b = path.points[i + 1];
      return { x: Phaser.Math.Linear(a.x, b.x, segmentT), y: Phaser.Math.Linear(a.y, b.y, segmentT) };
    }
    distance -= segmentLength;
  }

  return path.points[path.points.length - 1];
}

interface Wisp {
  gfx: Phaser.GameObjects.Ellipse;
  path: ScentPath;
  progress: number;
}

// World darkens further + scent wisps drift along authored paths while
// sniffing, both gated by the same lingering visibility value.
export class ScentSystem {
  private wisps: Wisp[] = [];
  private darkenOverlay: Phaser.GameObjects.Rectangle;
  private visibility = 0;
  private lingerRemainingMs = 0;
  private wispRadius = BASE_WISP_RADIUS;
  private wispAlpha = BASE_WISP_ALPHA;
  private lingerMs = BASE_LINGER_MS;

  constructor(scene: Phaser.Scene, paths: ScentPoint[][], tokenCount = 0) {
    const { width, height } = scene.scale;
    this.applyTokenBuff(tokenCount);

    this.darkenOverlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
    this.darkenOverlay.setScrollFactor(0);
    this.darkenOverlay.setDepth(OVERLAY_DEPTH);

    for (const points of paths) {
      const path = buildPath(points);
      for (let i = 0; i < WISPS_PER_PATH; i++) {
        const start = points[0];
        const gfx = scene.add.ellipse(start.x, start.y, this.wispRadius * 2, this.wispRadius * 2, WISP_COLOR, 0);
        gfx.setDepth(WISP_DEPTH);
        this.wisps.push({ gfx, path, progress: i / WISPS_PER_PATH });
      }
    }
  }

  // Re-applies the Memory Token buff live (ClueSystem calls this right
  // after a pickup, so the reward is felt immediately, not just after a
  // reload) — resizes already-created wisps rather than rebuilding them.
  setTokenBuff(tokenCount: number): void {
    this.applyTokenBuff(tokenCount);
    for (const wisp of this.wisps) {
      wisp.gfx.setSize(this.wispRadius * 2, this.wispRadius * 2);
    }
  }

  private applyTokenBuff(tokenCount: number): void {
    this.wispRadius = BASE_WISP_RADIUS + tokenCount * RADIUS_PER_TOKEN;
    this.wispAlpha = Math.min(1, BASE_WISP_ALPHA + tokenCount * ALPHA_PER_TOKEN);
    this.lingerMs = BASE_LINGER_MS + tokenCount * LINGER_PER_TOKEN_MS;
  }

  update(deltaSeconds: number, sniffing: boolean): void {
    if (sniffing) {
      this.visibility = 1;
      this.lingerRemainingMs = this.lingerMs;
    } else if (this.lingerRemainingMs > 0) {
      this.lingerRemainingMs -= deltaSeconds * 1000;
      this.visibility = Phaser.Math.Clamp(this.lingerRemainingMs / this.lingerMs, 0, 1);
    } else {
      this.visibility = 0;
    }

    this.darkenOverlay.setFillStyle(0x000000, DARKEN_ALPHA * this.visibility);

    for (const wisp of this.wisps) {
      const speedT = wisp.path.totalLength > 0 ? WISP_SPEED / wisp.path.totalLength : 0;
      wisp.progress = (wisp.progress + speedT * deltaSeconds) % 1;
      const pos = pointAlongPath(wisp.path, wisp.progress);
      wisp.gfx.x = pos.x;
      wisp.gfx.y = pos.y;
      wisp.gfx.setFillStyle(WISP_COLOR, this.wispAlpha * this.visibility);
    }
  }
}
