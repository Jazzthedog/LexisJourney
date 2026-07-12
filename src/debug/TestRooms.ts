import Phaser from "phaser";
import { FogLayers } from "../fx/Fog";

export interface TestRoomHandle {
  update?: (deltaSeconds: number) => void;
}

export interface TestRoom {
  key: string;
  name: string;
  build: (scene: Phaser.Scene) => TestRoomHandle | void;
}

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

function buildSilhouetteDepth(scene: Phaser.Scene, width: number, height: number): DriftLayer[] {
  const wrapWidth = width + 200;
  const layers: DriftLayer[] = [];

  for (const cfg of SILHOUETTE_LAYERS) {
    const rects: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < cfg.count; i++) {
      const h = Phaser.Math.Between(cfg.minH, cfg.maxH);
      const w = Phaser.Math.Between(20, 50);
      const x = (width / cfg.count) * i + Phaser.Math.Between(-30, 30);
      const rect = scene.add.rectangle(x, height * cfg.yFrac, w, h, cfg.color);
      rect.setOrigin(0.5, 1);
      rect.setDepth(cfg.depth);
      rects.push(rect);
    }
    layers.push({ rects, speed: cfg.speed, wrapWidth });
  }

  return layers;
}

const emptyRoom: TestRoom = {
  key: "1",
  name: "Empty",
  build: (scene) => {
    scene.cameras.main.setBackgroundColor(0x1a1a1a);
  },
};

const moodRoom: TestRoom = {
  key: "2",
  name: "Mood",
  build: (scene) => {
    const { width, height } = scene.scale;
    scene.cameras.main.setBackgroundColor(0x0a0a0a);

    const driftLayers = buildSilhouetteDepth(scene, width, height);
    const fog = new FogLayers(scene, width, height);

    return {
      update: (dt: number) => {
        fog.update(dt);
        for (const layer of driftLayers) {
          for (const rect of layer.rects) {
            rect.x -= layer.speed * dt;
            if (rect.x < -100) {
              rect.x += layer.wrapWidth;
            }
          }
        }
      },
    };
  },
};

const physicsSandboxRoom: TestRoom = {
  key: "3",
  name: "Physics Sandbox",
  build: (scene) => {
    scene.cameras.main.setBackgroundColor(0x1a1a1a);

    const ground = scene.add.rectangle(640, 700, 1280, 40, 0x333333);
    scene.physics.add.existing(ground, true);

    const box = scene.add.rectangle(640, 100, 40, 40, 0xdddddd);
    scene.physics.add.existing(box, false);
    const body = box.body as Phaser.Physics.Arcade.Body;
    body.setBounce(0.3, 0.3).setCollideWorldBounds(true);

    scene.physics.add.collider(box, ground);
  },
};

export const TEST_ROOMS: TestRoom[] = [emptyRoom, moodRoom, physicsSandboxRoom];
export const DEFAULT_ROOM_KEY = moodRoom.key;
