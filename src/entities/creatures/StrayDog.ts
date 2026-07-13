import Phaser from "phaser";
import type { SoundReactive } from "../SoundReactive";

const MOVE_SPEED = 150; // px/s

export interface StationPoint {
  x: number;
  y: number;
}

// A bark-aimed switch, not a companion — per PROMPTS P2.3, deliberately no
// free-follow pathfinding. Each bark toggles which of its two authored
// station points it walks toward in a straight line, matching SPEC §2's
// "sits on plates / holds levers on a bark command." Exposes a physics body
// so PressurePlate can count it as weight once it settles on a plate
// station, reusing P2.1's plate/gate machinery with zero new plumbing.
export class StrayDog implements SoundReactive {
  readonly gameObject: Phaser.GameObjects.Rectangle;

  private readonly stations: [StationPoint, StationPoint];
  private targetIndex: 0 | 1 = 0;

  constructor(scene: Phaser.Scene, start: StationPoint, other: StationPoint) {
    this.stations = [start, other];

    this.gameObject = scene.add.rectangle(start.x, start.y, 34, 30, 0x1a1a1a);
    scene.physics.add.existing(this.gameObject, false);
    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setAllowGravity(false);
  }

  onBark(_originX: number, _originY: number): void {
    this.targetIndex = this.targetIndex === 0 ? 1 : 0;
  }

  update(deltaSeconds: number): void {
    const target = this.stations[this.targetIndex];
    const dx = target.x - this.gameObject.x;
    const dy = target.y - this.gameObject.y;
    const dist = Math.hypot(dx, dy);

    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    if (dist < 1) {
      body.reset(target.x, target.y);
      return;
    }

    const step = Math.min(dist, MOVE_SPEED * deltaSeconds);
    const x = this.gameObject.x + (dx / dist) * step;
    const y = this.gameObject.y + (dy / dist) * step;
    this.gameObject.setPosition(x, y);
    body.reset(x, y);
  }
}
