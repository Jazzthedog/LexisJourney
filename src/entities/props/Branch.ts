import Phaser from "phaser";

const RISE_LERP_RATE = 4; // per second

// A perch that springs up once nothing's weighing it down — PROMPTS P2.3's
// "the crow's branch is a physics platform that rises when they leave."
// Kinematic, same body.reset-per-frame technique as Gate/Seesaw: there's no
// spring simulation, just a scripted lerp between two heights. Doesn't know
// about Crow at all — the room decides what "weighted" means and calls
// setWeighted, the same composition style as PressurePlate driving a Gate.
export class Branch {
  readonly gameObject: Phaser.GameObjects.Rectangle;

  private readonly x: number;
  private readonly restingY: number;
  private readonly risenY: number;
  private currentY: number;
  private weighted = true;

  constructor(scene: Phaser.Scene, x: number, restingY: number, risenY: number, width: number, height: number) {
    this.x = x;
    this.restingY = restingY;
    this.risenY = risenY;
    this.currentY = restingY;

    this.gameObject = scene.add.rectangle(x, restingY, width, height, 0x2a2118);
    scene.physics.add.existing(this.gameObject, false);
    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setAllowGravity(false);
  }

  get surfaceY(): number {
    return this.currentY;
  }

  setWeighted(weighted: boolean): void {
    this.weighted = weighted;
  }

  update(deltaSeconds: number): void {
    const target = this.weighted ? this.restingY : this.risenY;
    const t = 1 - Math.exp(-RISE_LERP_RATE * deltaSeconds);
    this.currentY = Phaser.Math.Linear(this.currentY, target, t);
    this.gameObject.y = this.currentY;
    (this.gameObject.body as Phaser.Physics.Arcade.Body).reset(this.x, this.currentY);
  }
}
