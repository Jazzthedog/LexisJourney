import Phaser from "phaser";
import type { Lexi } from "../Lexi";
import type { Grabbable } from "./Grabbable";

const HANDLE_SIZE = 18;
const HANDLE_SPEED_MULTIPLIER = 0.6;
const HANDLE_DRAG = 900;
const PULL_DISTANCE = 100; // px of horizontal drag from rest that reads as a full pull

// The Lexi-side rope end: dragged along the ground exactly like a Crate
// (P1.2), but its displacement from rest is read as "pull amount" by a
// paired Counterweight instead of carrying anything itself. Per SPEC §5
// this is a scripted constraint, not a simulated rope — there's no physics
// link between the two props, just one prop reading the other's position.
export class RopeHandle implements Grabbable {
  readonly kind = "drag" as const;
  readonly gameObject: Phaser.GameObjects.Rectangle;
  readonly speedMultiplier = HANDLE_SPEED_MULTIPLIER;

  private readonly restX: number;
  private readonly pullDirection: 1 | -1;

  constructor(scene: Phaser.Scene, x: number, y: number, pullDirection: 1 | -1 = 1) {
    this.restX = x;
    this.pullDirection = pullDirection;

    this.gameObject = scene.add.rectangle(x, y, HANDLE_SIZE, HANDLE_SIZE, 0x555555);
    scene.physics.add.existing(this.gameObject, false);

    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.setDragX(HANDLE_DRAG);
    body.setMaxVelocity(300, 1000);
  }

  get pullAmount(): number {
    const traveled = (this.gameObject.x - this.restX) * this.pullDirection;
    return Phaser.Math.Clamp(traveled / PULL_DISTANCE, 0, 1);
  }

  onGrab(_holder: Lexi): void {
    // Nothing to set up beyond what onHeldUpdate does each frame.
  }

  onHeldUpdate(holder: Lexi, _deltaSeconds: number): void {
    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.velocity.x = holder.body.velocity.x;
  }

  onRelease(_holder: Lexi): void {
    // Left with its current velocity; HANDLE_DRAG brings it to rest in
    // place — no spring-back, so a pulled counterweight stays raised.
  }
}

const COUNTERWEIGHT_WIDTH = 90;
const COUNTERWEIGHT_HEIGHT = 20;

// The far-side platform that rises as the paired RopeHandle is pulled.
// Purely kinematic — repositioned via body.reset each frame, same technique
// as Gate and Seesaw — so it can safely carry Lexi's weight while "hanging".
export class Counterweight {
  readonly gameObject: Phaser.GameObjects.Rectangle;

  private readonly restY: number;
  private readonly raisedY: number;

  constructor(scene: Phaser.Scene, x: number, restY: number, raisedY: number) {
    this.restY = restY;
    this.raisedY = raisedY;

    this.gameObject = scene.add.rectangle(x, restY, COUNTERWEIGHT_WIDTH, COUNTERWEIGHT_HEIGHT, 0x4a4a4a);
    scene.physics.add.existing(this.gameObject, false);

    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setAllowGravity(false);
  }

  update(pullAmount: number): void {
    const y = Phaser.Math.Linear(this.restY, this.raisedY, pullAmount);
    this.gameObject.y = y;
    (this.gameObject.body as Phaser.Physics.Arcade.Body).reset(this.gameObject.x, y);
  }
}
