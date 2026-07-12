import Phaser from "phaser";
import { GrainPipeline } from "../fx/Grain";
import { FogLayers } from "../fx/Fog";

interface DriftLayer {
  rects: Phaser.GameObjects.Rectangle[];
  speed: number;
  wrapWidth: number;
}

// Depth cue for the mood test: each layer drifts at its own speed (nearer =
// faster, darker) so the parallax reads even with no camera or player yet.
const SILHOUETTE_LAYERS = [
  { count: 6, speed: 6, color: 0x161616, minH: 60, maxH: 140, yFrac: 0.55, depth: 1 },
  { count: 5, speed: 14, color: 0x0d0d0d, minH: 100, maxH: 220, yFrac: 0.68, depth: 2 },
  { count: 4, speed: 26, color: 0x000000, minH: 160, maxH: 320, yFrac: 0.85, depth: 3 },
];

export class GameScene extends Phaser.Scene {
  private grain?: GrainPipeline;
  private fog?: FogLayers;
  private driftLayers: DriftLayer[] = [];

  constructor() {
    super("Game");
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(0x0a0a0a);

    this.buildSilhouetteDepth(width, height);
    this.fog = new FogLayers(this, width, height);
    this.setupGrain();

    this.input.keyboard?.on("keydown-G", () => {
      this.grain?.toggleGrain();
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.fog?.update(dt);

    for (const layer of this.driftLayers) {
      for (const rect of layer.rects) {
        rect.x -= layer.speed * dt;
        if (rect.x < -100) {
          rect.x += layer.wrapWidth;
        }
      }
    }
  }

  private setupGrain(): void {
    if (this.game.renderer.type !== Phaser.WEBGL) {
      // Post FX pipelines need WebGL; Canvas fallback just skips the mood layer.
      return;
    }

    const pipelines = (this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).pipelines;
    if (!pipelines.has("Grain")) {
      pipelines.addPostPipeline("Grain", GrainPipeline);
    }

    this.cameras.main.setPostPipeline("Grain");
    this.grain = this.cameras.main.getPostPipeline("Grain") as GrainPipeline;
  }

  private buildSilhouetteDepth(width: number, height: number): void {
    const wrapWidth = width + 200;

    for (const cfg of SILHOUETTE_LAYERS) {
      const rects: Phaser.GameObjects.Rectangle[] = [];
      for (let i = 0; i < cfg.count; i++) {
        const h = Phaser.Math.Between(cfg.minH, cfg.maxH);
        const w = Phaser.Math.Between(20, 50);
        const x = (width / cfg.count) * i + Phaser.Math.Between(-30, 30);
        const rect = this.add.rectangle(x, height * cfg.yFrac, w, h, cfg.color);
        rect.setOrigin(0.5, 1);
        rect.setDepth(cfg.depth);
        rects.push(rect);
      }
      this.driftLayers.push({ rects, speed: cfg.speed, wrapWidth });
    }
  }
}
