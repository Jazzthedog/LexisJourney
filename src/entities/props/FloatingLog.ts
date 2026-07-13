import Phaser from "phaser";

const BOB_AMPLITUDE = 10;

// A stepping-stone across a WaterZone. Per SPEC §5 this is a bobbing
// kinematic platform, not a buoyancy simulation: Y is a scripted sine wave,
// repositioned via body.reset each frame — the same technique already used
// for Gate and Seesaw — so anything resting on it rides along.
export class FloatingLog {
  readonly gameObject: Phaser.GameObjects.Rectangle;

  private readonly restY: number;
  private readonly bobPeriodS: number;
  private readonly phaseOffset: number;
  private elapsedS = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    bobPeriodS: number,
    phaseOffset = 0,
  ) {
    this.restY = y;
    this.bobPeriodS = bobPeriodS;
    this.phaseOffset = phaseOffset;

    this.gameObject = scene.add.rectangle(x, y, width, height, 0x2a2118);
    scene.physics.add.existing(this.gameObject, false);
    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setAllowGravity(false);
  }

  update(deltaSeconds: number): void {
    this.elapsedS += deltaSeconds;
    const y = this.restY + Math.sin((this.elapsedS / this.bobPeriodS) * Math.PI * 2 + this.phaseOffset) * BOB_AMPLITUDE;
    this.gameObject.y = y;
    (this.gameObject.body as Phaser.Physics.Arcade.Body).reset(this.gameObject.x, y);
  }
}
