import Phaser from "phaser";
import { FogLayers } from "../fx/Fog";
import { Lexi, LexiInteractables } from "../entities/Lexi";
import { InputMap } from "../systems/InputMap";
import type { Grabbable } from "../entities/props/Grabbable";
import { Crate } from "../entities/props/Crate";
import { Ball } from "../entities/props/Ball";
import { DigSpot } from "../entities/props/DigSpot";
import { Crow } from "../entities/creatures/Crow";
import { ScentSystem, ScentPoint } from "../systems/ScentSystem";
import { PuzzleRegistry } from "../systems/PuzzleWiring";
import { Lever } from "../entities/props/Lever";
import { Gate } from "../entities/props/Gate";
import { PressurePlate } from "../entities/props/PressurePlate";
import { Seesaw, SeesawWeight } from "../entities/props/Seesaw";
import { RopeHandle, Counterweight } from "../entities/props/Pulley";

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

interface PlatformSpec {
  x: number;
  y: number;
  w: number;
  h: number;
}

// A short staircase (tests jump height + gap judgment) into a long straight
// run (tests top speed/acceleration) into a small closing hop.
const MOVEMENT_PLATFORMS: PlatformSpec[] = [
  { x: 250, y: 700, w: 500, h: 40 }, // start ground
  { x: 775, y: 620, w: 250, h: 30 }, // step up
  { x: 1175, y: 540, w: 250, h: 30 }, // step up again
  { x: 1775, y: 700, w: 650, h: 40 }, // long run (drop back down from the stairs)
  { x: 2250, y: 620, w: 150, h: 30 }, // small hop
  { x: 2700, y: 700, w: 700, h: 40 }, // finish ground
];
const MOVEMENT_WORLD_WIDTH = 3200;
const MOVEMENT_WORLD_HEIGHT = 720;

const CAMERA_LOOK_AHEAD_PX = 140;
const CAMERA_SMOOTH_PER_SEC = 8; // higher = snappier follow

function expSmooth(current: number, target: number, ratePerSecond: number, deltaSeconds: number): number {
  const t = 1 - Math.exp(-ratePerSecond * deltaSeconds);
  return Phaser.Math.Linear(current, target, t);
}

function buildPlatforms(scene: Phaser.Scene, specs: PlatformSpec[]): Phaser.Physics.Arcade.StaticGroup {
  const platforms = scene.physics.add.staticGroup();
  for (const spec of specs) {
    const platform = scene.add.rectangle(spec.x, spec.y, spec.w, spec.h, 0x333333);
    scene.physics.add.existing(platform, true);
    platforms.add(platform);
  }
  return platforms;
}

// Shared by every room that spawns a playable Lexi: creates her + input,
// registers scene.lexi for DebugHarness (P0.3), and returns a per-frame
// update that also drives the manual camera look-ahead (skipped during
// DebugHarness free-fly).
function createPlayerRig(scene: Phaser.Scene, spawnX: number, spawnY: number, interactables: LexiInteractables = {}) {
  const input = new InputMap(scene);
  const lexi = new Lexi(scene, spawnX, spawnY, input);

  (scene as unknown as { lexi?: Lexi }).lexi = lexi;

  const updatePlayerAndCamera = (dt: number) => {
    input.update();
    lexi.update(dt, interactables);

    if (scene.data.get("debugFreeFly")) {
      return;
    }

    const cam = scene.cameras.main;
    const targetScrollX = lexi.x + lexi.facingDirection * CAMERA_LOOK_AHEAD_PX - cam.width / 2;
    cam.scrollX = expSmooth(cam.scrollX, targetScrollX, CAMERA_SMOOTH_PER_SEC, dt);
    cam.scrollY = expSmooth(cam.scrollY, lexi.y - cam.height / 2, CAMERA_SMOOTH_PER_SEC, dt);
  };

  return { lexi, updatePlayerAndCamera };
}

const movementRoom: TestRoom = {
  key: "4",
  name: "Movement",
  build: (scene) => {
    scene.cameras.main.setBackgroundColor(0x141414);
    scene.physics.world.setBounds(0, 0, MOVEMENT_WORLD_WIDTH, MOVEMENT_WORLD_HEIGHT);
    scene.cameras.main.setBounds(0, 0, MOVEMENT_WORLD_WIDTH, MOVEMENT_WORLD_HEIGHT);

    const platforms = buildPlatforms(scene, MOVEMENT_PLATFORMS);
    const { lexi, updatePlayerAndCamera } = createPlayerRig(scene, 100, 600);
    scene.physics.add.collider(lexi, platforms);

    return { update: updatePlayerAndCamera };
  },
};

// A crate-boost puzzle (drag the crate to the base of a ledge too high to
// jump to directly, then jump from crate-top up past its edge — not from
// directly underneath it, which just bonks its underside) followed by a
// carry-across-a-gap puzzle (the ball waits on the ledge; carrying it
// survives the jump to the final platform).
const GRAB_PLATFORMS: PlatformSpec[] = [
  { x: 400, y: 700, w: 800, h: 40 }, // start ground — ends well before the ledge
  { x: 850, y: 505, w: 200, h: 30 }, // high ledge — top edge y=490, spans 750..950
  { x: 1150, y: 600, w: 300, h: 40 }, // finish platform, across a gap from the ledge
];
const GRAB_WORLD_WIDTH = 1450;
const GRAB_WORLD_HEIGHT = 720;

const grabRoom: TestRoom = {
  key: "5",
  name: "Grab",
  build: (scene) => {
    scene.cameras.main.setBackgroundColor(0x141414);
    scene.physics.world.setBounds(0, 0, GRAB_WORLD_WIDTH, GRAB_WORLD_HEIGHT);
    scene.cameras.main.setBounds(0, 0, GRAB_WORLD_WIDTH, GRAB_WORLD_HEIGHT);

    const platforms = buildPlatforms(scene, GRAB_PLATFORMS);

    const crate = new Crate(scene, 150, 650);
    scene.physics.add.collider(crate.gameObject, platforms);

    const ball = new Ball(scene, 850, 470);
    scene.physics.add.collider(ball.gameObject, platforms);

    const grabCandidates: Grabbable[] = [crate, ball];
    const { lexi, updatePlayerAndCamera } = createPlayerRig(scene, 100, 600, { grabCandidates });
    scene.physics.add.collider(lexi, platforms);
    scene.physics.add.collider(crate.gameObject, lexi);

    return { update: updatePlayerAndCamera };
  },
};

// A crow to bark off, a scent trail leading to a buried ball, and a fence
// (too tall to jump — genuinely requires digging under, not just walking
// around) blocking the way onward.
const SENSES_PLATFORMS: PlatformSpec[] = [{ x: 450, y: 700, w: 900, h: 40 }];
const SENSES_WORLD_WIDTH = 1000;
const SENSES_WORLD_HEIGHT = 720;
const SENSES_SCENT_PATH: ScentPoint[] = [
  { x: 80, y: 660 },
  { x: 250, y: 662 },
  { x: 450, y: 665 },
];

const sensesRoom: TestRoom = {
  key: "6",
  name: "Senses",
  build: (scene) => {
    scene.cameras.main.setBackgroundColor(0x141414);
    scene.physics.world.setBounds(0, 0, SENSES_WORLD_WIDTH, SENSES_WORLD_HEIGHT);
    scene.cameras.main.setBounds(0, 0, SENSES_WORLD_WIDTH, SENSES_WORLD_HEIGHT);

    const platforms = buildPlatforms(scene, SENSES_PLATFORMS);

    const crow = new Crow(scene, 250, 615);

    const ball = new Ball(scene, 450, 665);
    ball.gameObject.setVisible(false);
    (ball.gameObject.body as Phaser.Physics.Arcade.Body).enable = false;
    scene.physics.add.collider(ball.gameObject, platforms);

    const ballDigSpot = new DigSpot(scene, 450, 675, 40, () => {
      ball.gameObject.setVisible(true);
      (ball.gameObject.body as Phaser.Physics.Arcade.Body).enable = true;
    });

    // Tall enough that jumping over isn't an option (Lexi's jump apex is
    // ~135px) — the fence must be dug under, not hopped.
    const fence = scene.add.rectangle(700, 580, 20, 200, 0x2a2a2a);
    scene.physics.add.existing(fence, true);

    const fenceDigSpot = new DigSpot(scene, 700, 675, 40, () => {
      fence.setVisible(false);
      (fence.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    });

    const scentSystem = new ScentSystem(scene, [SENSES_SCENT_PATH]);

    const grabCandidates: Grabbable[] = [ball];
    const soundReactive = [crow];
    const digSpots = [ballDigSpot, fenceDigSpot];

    const { lexi, updatePlayerAndCamera } = createPlayerRig(scene, 80, 600, {
      grabCandidates,
      soundReactive,
      digSpots,
    });
    scene.physics.add.collider(lexi, platforms);
    scene.physics.add.collider(lexi, fence);

    return {
      update: (dt: number) => {
        updatePlayerAndCamera(dt);
        crow.update(dt);
        scentSystem.update(dt, lexi.isSniffing);
      },
    };
  },
};

// One long room strung with all five P2.1 puzzle bricks in sequence:
// lever -> gate, rope/counterweight, seesaw, then the required combo —
// a pressure plate holding a second gate open only while weighted, solved
// by dragging the crate onto it since Lexi can't stand on the plate and
// walk through the gate at the same time.
const PROPS_PLATFORMS: PlatformSpec[] = [
  { x: 500, y: 700, w: 1000, h: 40 }, // ground A: lever + gate 01
  { x: 1150, y: 800, w: 340, h: 20 }, // safety net under the pulley gap
  { x: 1400, y: 675, w: 200, h: 30 }, // ledge B: landing for the raised counterweight
  { x: 1600, y: 700, w: 200, h: 40 }, // ground C: approach to the seesaw
  { x: 2050, y: 700, w: 300, h: 40 }, // ground D: past the seesaw, crate sits here
  { x: 2450, y: 700, w: 500, h: 40 }, // ground E: pressure plate + gate 02 combo
];
const PROPS_WORLD_WIDTH = 2900;
const PROPS_WORLD_HEIGHT = 900;

function seesawWeightSide(seesaw: Seesaw, bodies: Phaser.Physics.Arcade.Body[]): SeesawWeight {
  const restsOn = (end: Phaser.GameObjects.Rectangle, body: Phaser.Physics.Arcade.Body): boolean => {
    const b = end.getBounds();
    const sensor = new Phaser.Geom.Rectangle(b.x, b.y - 20, b.width, b.height + 20);
    const bodyRect = new Phaser.Geom.Rectangle(body.position.x, body.position.y, body.width, body.height);
    return Phaser.Geom.Intersects.RectangleToRectangle(sensor, bodyRect);
  };

  for (const body of bodies) {
    if (restsOn(seesaw.leftEnd, body)) return "left";
    if (restsOn(seesaw.rightEnd, body)) return "right";
  }
  return "none";
}

const mechanicalPropsRoom: TestRoom = {
  key: "7",
  name: "Mechanical Props",
  build: (scene) => {
    scene.cameras.main.setBackgroundColor(0x141414);
    scene.physics.world.setBounds(0, 0, PROPS_WORLD_WIDTH, PROPS_WORLD_HEIGHT);
    scene.cameras.main.setBounds(0, 0, PROPS_WORLD_WIDTH, PROPS_WORLD_HEIGHT);

    const platforms = buildPlatforms(scene, PROPS_PLATFORMS);
    const registry = new PuzzleRegistry();

    const gateA = new Gate(scene, 650, 610, 16, 140, "gate_01");
    registry.register(gateA);
    const lever = new Lever(scene, 250, 680, ["gate_01"], registry);

    const ropeHandle = new RopeHandle(scene, 900, 650, 1);
    scene.physics.add.collider(ropeHandle.gameObject, platforms);
    const counterweight = new Counterweight(scene, 1150, 760, 660);

    const seesaw = new Seesaw(scene, 1800, 690);

    const crate = new Crate(scene, 2150, 650);
    scene.physics.add.collider(crate.gameObject, platforms);

    const gateB = new Gate(scene, 2550, 610, 16, 140, "gate_02");
    registry.register(gateB);
    const plate = new PressurePlate(scene, 2350, 680, 80, ["gate_02"], registry);

    const grabCandidates: Grabbable[] = [lever, ropeHandle, crate];
    const { lexi, updatePlayerAndCamera } = createPlayerRig(scene, 100, 600, { grabCandidates });

    scene.physics.add.collider(lexi, platforms);
    scene.physics.add.collider(lexi, gateA.gameObject);
    scene.physics.add.collider(lexi, gateB.gameObject);
    scene.physics.add.collider(lexi, ropeHandle.gameObject);
    scene.physics.add.collider(lexi, crate.gameObject);
    scene.physics.add.collider(lexi, counterweight.gameObject);
    scene.physics.add.collider(lexi, seesaw.leftEnd);
    scene.physics.add.collider(lexi, seesaw.rightEnd);
    scene.physics.add.collider(crate.gameObject, gateA.gameObject);
    scene.physics.add.collider(crate.gameObject, gateB.gameObject);

    return {
      update: (dt: number) => {
        updatePlayerAndCamera(dt);
        counterweight.update(ropeHandle.pullAmount);
        seesaw.update(dt, seesawWeightSide(seesaw, [lexi.body]));
        plate.update([lexi.body, crate.gameObject.body as Phaser.Physics.Arcade.Body]);
      },
    };
  },
};

export const TEST_ROOMS: TestRoom[] = [
  emptyRoom,
  moodRoom,
  physicsSandboxRoom,
  movementRoom,
  grabRoom,
  sensesRoom,
  mechanicalPropsRoom,
];
export const DEFAULT_ROOM_KEY = moodRoom.key;
