import Phaser from "phaser";

const FADE_MS = 500;
const HOLD_MS = 3000;
const TOTAL_MS = FADE_MS * 2 + HOLD_MS; // 4000ms — SPEC §2's "4 seconds" memory-echo vignette
const BACKDROP_ALPHA = 0.88;
const GHOST_COLOR = 0xcccccc;
const GHOST_ALPHA = 0.55;
const DOG_COLOR = 0x999999;
const VIGNETTE_DEPTH = 500;
const FOG_DRIFT_PX_PER_SEC = 6;

type Phase = "in" | "hold" | "out" | "done";

function buildGhostFigure(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const head = scene.add.ellipse(0, -58, 22, 24, GHOST_COLOR, GHOST_ALPHA);
  const body = scene.add.ellipse(0, -20, 34, 60, GHOST_COLOR, GHOST_ALPHA);
  return scene.add.container(x, y, [body, head]);
}

function buildGhostDog(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const body = scene.add.ellipse(0, 0, 34, 18, DOG_COLOR, GHOST_ALPHA);
  const ear = scene.add.triangle(14, -10, 0, 8, 0, -8, 10, 0, DOG_COLOR, GHOST_ALPHA);
  return scene.add.container(x, y, [body, ear]);
}

// A wordless "memory echo": a static ghostly-silhouette tableau (SPEC §2 —
// triggered by collecting a family clue) held for ~4s with fog + grain,
// then fades back to gameplay. The 4-note whistle motif SPEC also calls for
// here is P3.3 scope — AudioSystem doesn't exist yet, so this is
// deliberately silent for now, the same call as WindZone's deferred audio
// swell cue in P2.2. `MemoryEchoVignette` only owns the visual sequence;
// pausing gameplay while it plays is the caller's job (see ClueSystem).
export class MemoryEchoVignette {
  private readonly container: Phaser.GameObjects.Container;
  private readonly fogStreaks: Phaser.GameObjects.Rectangle[];
  private phase: Phase = "in";
  private elapsedMs = 0;
  private readonly onComplete: () => void;

  constructor(scene: Phaser.Scene, onComplete: () => void) {
    this.onComplete = onComplete;
    const { width, height } = scene.scale;

    const backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, BACKDROP_ALPHA);
    const figureA = buildGhostFigure(scene, width * 0.42, height * 0.6);
    const figureB = buildGhostFigure(scene, width * 0.58, height * 0.58);
    const dog = buildGhostDog(scene, width * 0.5, height * 0.72);

    this.fogStreaks = [
      scene.add.rectangle(width * 0.3, height * 0.5, width * 0.9, 40, 0xaaaaaa, 0.12),
      scene.add.rectangle(width * 0.7, height * 0.62, width * 0.9, 30, 0xaaaaaa, 0.1),
    ];

    this.container = scene.add.container(0, 0, [backdrop, ...this.fogStreaks, figureA, figureB, dog]);
    this.container.setScrollFactor(0);
    this.container.setDepth(VIGNETTE_DEPTH);
    this.container.setAlpha(0);
  }

  get isDone(): boolean {
    return this.phase === "done";
  }

  update(deltaSeconds: number): void {
    if (this.phase === "done") {
      return;
    }
    this.elapsedMs += deltaSeconds * 1000;

    for (const streak of this.fogStreaks) {
      streak.x += FOG_DRIFT_PX_PER_SEC * deltaSeconds;
    }

    if (this.phase === "in") {
      this.container.setAlpha(Phaser.Math.Clamp(this.elapsedMs / FADE_MS, 0, 1));
      if (this.elapsedMs >= FADE_MS) {
        this.phase = "hold";
      }
    } else if (this.phase === "hold") {
      if (this.elapsedMs >= FADE_MS + HOLD_MS) {
        this.phase = "out";
      }
    } else if (this.phase === "out") {
      const outElapsedMs = this.elapsedMs - FADE_MS - HOLD_MS;
      this.container.setAlpha(1 - Phaser.Math.Clamp(outElapsedMs / FADE_MS, 0, 1));
      if (this.elapsedMs >= TOTAL_MS) {
        this.phase = "done";
        this.container.destroy();
        this.onComplete();
      }
    }
  }
}
