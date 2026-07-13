import Phaser from "phaser";

const HALF_LENGTH = 100;
const PLANK_THICKNESS = 14;
const END_WIDTH = 60;
const END_HEIGHT = 16;
const MAX_ANGLE = 0.3; // radians, ~17 degrees
const LERP_RATE = 3; // per second

export type SeesawWeight = "left" | "right" | "none";

// A pivoting plank whose rotation is scripted from weight distribution, not
// simulated — per SPEC §5, Arcade bodies can't rotate their collision shape,
// so the two end platforms are kinematic rectangles repositioned every
// frame to trace the plank's rotated endpoints (body.reset, same technique
// as Gate). Which side is "weighted" is the room's call, not this class's —
// pass it in each frame via update().
export class Seesaw {
  readonly plank: Phaser.GameObjects.Rectangle;
  readonly leftEnd: Phaser.GameObjects.Rectangle;
  readonly rightEnd: Phaser.GameObjects.Rectangle;

  private readonly pivotX: number;
  private readonly pivotY: number;
  private angle = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.pivotX = x;
    this.pivotY = y;

    this.plank = scene.add.rectangle(x, y, HALF_LENGTH * 2, PLANK_THICKNESS, 0x3a3a3a);
    this.leftEnd = scene.add.rectangle(x - HALF_LENGTH, y, END_WIDTH, END_HEIGHT, 0x4a4a4a);
    this.rightEnd = scene.add.rectangle(x + HALF_LENGTH, y, END_WIDTH, END_HEIGHT, 0x4a4a4a);

    for (const end of [this.leftEnd, this.rightEnd]) {
      scene.physics.add.existing(end, false);
      const body = end.body as Phaser.Physics.Arcade.Body;
      body.setImmovable(true);
      body.setAllowGravity(false);
    }
  }

  get tiltAngle(): number {
    return this.angle;
  }

  update(deltaSeconds: number, weight: SeesawWeight): void {
    const targetAngle = weight === "left" ? -MAX_ANGLE : weight === "right" ? MAX_ANGLE : 0;
    const t = 1 - Math.exp(-LERP_RATE * deltaSeconds);
    this.angle = Phaser.Math.Linear(this.angle, targetAngle, t);

    this.plank.rotation = this.angle;

    const leftX = this.pivotX - HALF_LENGTH * Math.cos(this.angle);
    const leftY = this.pivotY - HALF_LENGTH * Math.sin(this.angle);
    const rightX = this.pivotX + HALF_LENGTH * Math.cos(this.angle);
    const rightY = this.pivotY + HALF_LENGTH * Math.sin(this.angle);

    this.leftEnd.setPosition(leftX, leftY);
    this.leftEnd.rotation = this.angle;
    this.rightEnd.setPosition(rightX, rightY);
    this.rightEnd.rotation = this.angle;

    (this.leftEnd.body as Phaser.Physics.Arcade.Body).reset(leftX, leftY);
    (this.rightEnd.body as Phaser.Physics.Arcade.Body).reset(rightX, rightY);
  }
}
