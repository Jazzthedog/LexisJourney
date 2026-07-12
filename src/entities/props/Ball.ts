import Phaser from "phaser";
import type { Lexi } from "../Lexi";
import type { Grabbable } from "./Grabbable";

const BALL_RADIUS = 12;
const MOUTH_OFFSET_X = 20;
const MOUTH_OFFSET_Y = -16;

export class Ball implements Grabbable {
  readonly kind = "carry" as const;
  readonly gameObject: Phaser.GameObjects.Ellipse;
  readonly speedMultiplier = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.gameObject = scene.add.ellipse(x, y, BALL_RADIUS * 2, BALL_RADIUS * 2, 0xcccccc);
    scene.physics.add.existing(this.gameObject, false);

    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.setBounce(0.3, 0.3);
    body.setCollideWorldBounds(true);
  }

  onGrab(holder: Lexi): void {
    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.followMouth(holder);
  }

  onHeldUpdate(holder: Lexi, _deltaSeconds: number): void {
    this.followMouth(holder);
  }

  onRelease(_holder: Lexi): void {
    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.velocity.set(0, 0);
  }

  private followMouth(holder: Lexi): void {
    this.gameObject.x = holder.x + holder.facingDirection * MOUTH_OFFSET_X;
    this.gameObject.y = holder.y + MOUTH_OFFSET_Y;
  }
}
