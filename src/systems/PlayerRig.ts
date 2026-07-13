import Phaser from "phaser";
import { Lexi, LexiInteractables } from "../entities/Lexi";
import { InputMap } from "./InputMap";

const CAMERA_LOOK_AHEAD_PX = 140;
const CAMERA_SMOOTH_PER_SEC = 8; // higher = snappier follow

export function expSmooth(current: number, target: number, ratePerSecond: number, deltaSeconds: number): number {
  const t = 1 - Math.exp(-ratePerSecond * deltaSeconds);
  return Phaser.Math.Linear(current, target, t);
}

// Shared by every room/level that spawns a playable Lexi: creates her +
// input, registers scene.lexi for DebugHarness (P0.3), and returns a
// per-frame update that also drives the manual camera look-ahead (skipped
// during DebugHarness free-fly). Used by both debug/TestRooms.ts and
// levels/LevelLoader.ts (P3.1) so a data-driven map gets identical player
// behavior to a hand-built test room.
export function createPlayerRig(
  scene: Phaser.Scene,
  spawnX: number,
  spawnY: number,
  interactables: LexiInteractables = {},
) {
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

  return { lexi, updatePlayerAndCamera, input };
}
