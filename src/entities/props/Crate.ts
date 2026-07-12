import Phaser from "phaser";
import type { Lexi } from "../Lexi";
import type { Grabbable } from "./Grabbable";

const CRATE_WIDTH = 50;
const CRATE_HEIGHT = 60;
const CRATE_DRAG = 900; // px/s^2 — how quickly it stops once released, so it doesn't slide forever
const CRATE_SPEED_MULTIPLIER = 0.55; // how much dragging it slows Lexi's run speed

export class Crate implements Grabbable {
  readonly kind = "drag" as const;
  readonly gameObject: Phaser.GameObjects.Rectangle;
  readonly speedMultiplier = CRATE_SPEED_MULTIPLIER;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.gameObject = scene.add.rectangle(x, y, CRATE_WIDTH, CRATE_HEIGHT, 0x2a2a2a);
    scene.physics.add.existing(this.gameObject, false);

    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.setDragX(CRATE_DRAG);
    body.setMaxVelocity(300, 1000);
  }

  onGrab(_holder: Lexi): void {
    // Nothing to set up beyond what onHeldUpdate does each frame.
  }

  onHeldUpdate(holder: Lexi, _deltaSeconds: number): void {
    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.velocity.x = holder.body.velocity.x;
  }

  onRelease(_holder: Lexi): void {
    // Left with its current velocity; CRATE_DRAG brings it to rest naturally.
  }
}
