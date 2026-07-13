import Phaser from "phaser";
import type { Targetable } from "../../systems/PuzzleWiring";

const GATE_TWEEN_MS = 260;

// A vertical barrier that slides up out of the way when activated. Per
// SPEC §5's physics note this is a scripted kinematic prop, not a simulated
// one: collision toggles instantly with activation state (opening drops
// collision immediately, closing restores it only once the animation
// finishes), and the slide itself is purely a visual cue.
export class Gate implements Targetable {
  readonly targetId: string;
  readonly gameObject: Phaser.GameObjects.Rectangle;

  private readonly scene: Phaser.Scene;
  private readonly closedY: number;
  private readonly openY: number;
  private open = false;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, targetId: string) {
    this.scene = scene;
    this.targetId = targetId;
    this.closedY = y;
    this.openY = y - height;

    this.gameObject = scene.add.rectangle(x, y, width, height, 0x2f2f2f);
    scene.physics.add.existing(this.gameObject, false);
    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setAllowGravity(false);
  }

  get isOpen(): boolean {
    return this.open;
  }

  setActivated(activated: boolean): void {
    if (activated === this.open) {
      return;
    }
    this.open = activated;

    const body = this.gameObject.body as Phaser.Physics.Arcade.Body;
    this.scene.tweens.killTweensOf(this.gameObject);

    if (activated) {
      body.enable = false;
      this.scene.tweens.add({
        targets: this.gameObject,
        y: this.openY,
        duration: GATE_TWEEN_MS,
        ease: "Sine.Out",
      });
    } else {
      this.scene.tweens.add({
        targets: this.gameObject,
        y: this.closedY,
        duration: GATE_TWEEN_MS,
        ease: "Sine.In",
        onComplete: () => {
          body.reset(this.gameObject.x, this.closedY);
          body.enable = true;
        },
      });
    }
  }
}
