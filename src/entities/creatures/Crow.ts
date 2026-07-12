import Phaser from "phaser";
import type { SoundReactive } from "../SoundReactive";

// Perched until barked at, then flies off. The "branch rises as a platform
// when it leaves" elaboration is P2.3 scope (SPEC §3/PROMPTS P2.3) — this is
// just the sound-reactive flee behavior P1.3 asks for.
const FLEE_SPEED_X = 140;
const FLEE_SPEED_Y = -90;

export class Crow implements SoundReactive {
  readonly gameObject: Phaser.GameObjects.Container;
  private fleeing = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.gameObject = scene.add.container(x, y);
    const body = scene.add.ellipse(0, 0, 22, 14, 0x0a0a0a);
    const beak = scene.add.triangle(11, 0, 0, -4, 0, 4, 8, 0, 0xdddddd);
    this.gameObject.add([body, beak]);
  }

  onBark(_originX: number, _originY: number): void {
    this.fleeing = true;
  }

  update(deltaSeconds: number): void {
    if (!this.fleeing) {
      return;
    }
    this.gameObject.x += FLEE_SPEED_X * deltaSeconds;
    this.gameObject.y += FLEE_SPEED_Y * deltaSeconds;
  }
}
