import Phaser from "phaser";

export type WindPhase = "idle" | "telegraph" | "gust";

const STREAK_COUNT = 3;
const LEAF_COUNT = 6;
const STREAK_SPEED = 260;
const LEAF_SPEED = 180;
const TELEGRAPH_ALPHA = 0.25;
const GUST_ALPHA = 0.5;

// Periodic gust with a mandatory telegraph window — SPEC §3 requires gusts
// be visible >=0.5s ahead, never a surprise. Force is only nonzero during
// the "gust" phase; the fog streaks and leaf shapes fade in during
// "telegraph" and drift across during "gust" as the visible cue.
export class WindZone {
  readonly gameObject: Phaser.GameObjects.Rectangle;

  private readonly bounds: Phaser.Geom.Rectangle;
  private readonly zoneX: number;
  private readonly zoneWidth: number;
  private readonly intervalMs: number;
  private readonly telegraphMs: number;
  private readonly gustDurationMs: number;
  private readonly gustForceX: number;
  private readonly streaks: Phaser.GameObjects.Rectangle[] = [];
  private readonly leaves: Phaser.GameObjects.Rectangle[] = [];
  private cycleMs = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    gustForceX: number,
    intervalMs: number,
    telegraphMs: number,
    gustDurationMs: number,
  ) {
    this.zoneX = x;
    this.zoneWidth = width;
    this.gustForceX = gustForceX;
    this.intervalMs = intervalMs;
    this.telegraphMs = telegraphMs;
    this.gustDurationMs = gustDurationMs;

    this.bounds = new Phaser.Geom.Rectangle(x - width / 2, y - height / 2, width, height);
    this.gameObject = scene.add.rectangle(x, y, width, height, 0x000000, 0);

    for (let i = 0; i < STREAK_COUNT; i++) {
      const streakY = y - height / 2 + ((i + 1) * height) / (STREAK_COUNT + 1);
      this.streaks.push(scene.add.rectangle(x - width / 2, streakY, 60, 3, 0xaaaaaa, 0));
    }
    for (let i = 0; i < LEAF_COUNT; i++) {
      const leafY = y - height / 2 + Phaser.Math.Between(0, height);
      this.leaves.push(scene.add.rectangle(x - width / 2, leafY, 6, 4, 0x888866, 0));
    }
  }

  get phase(): WindPhase {
    const gustStart = this.intervalMs - this.gustDurationMs;
    const telegraphStart = gustStart - this.telegraphMs;
    if (this.cycleMs >= gustStart) return "gust";
    if (this.cycleMs >= telegraphStart) return "telegraph";
    return "idle";
  }

  get currentForceX(): number {
    return this.phase === "gust" ? this.gustForceX : 0;
  }

  contains(x: number, y: number): boolean {
    return Phaser.Geom.Rectangle.Contains(this.bounds, x, y);
  }

  update(deltaSeconds: number): void {
    this.cycleMs = (this.cycleMs + deltaSeconds * 1000) % this.intervalMs;
    const phase = this.phase;
    const direction = Math.sign(this.gustForceX || 1);
    const rightEdge = this.zoneX + this.zoneWidth / 2;
    const leftEdge = this.zoneX - this.zoneWidth / 2;

    const cueAlpha = phase === "gust" ? GUST_ALPHA : phase === "telegraph" ? TELEGRAPH_ALPHA : 0;

    for (const streak of this.streaks) {
      streak.setAlpha(cueAlpha);
      if (phase === "gust") {
        streak.x += STREAK_SPEED * deltaSeconds * direction;
        if (streak.x > rightEdge) streak.x = leftEdge;
      }
    }

    for (const leaf of this.leaves) {
      leaf.setAlpha(cueAlpha);
      if (phase === "gust") {
        leaf.x += LEAF_SPEED * deltaSeconds * direction;
        leaf.rotation += 4 * deltaSeconds;
        if (leaf.x > rightEdge) leaf.x = leftEdge;
      }
    }
  }
}
