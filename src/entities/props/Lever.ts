import Phaser from "phaser";
import type { Lexi } from "../Lexi";
import type { Grabbable } from "./Grabbable";
import type { PuzzleRegistry } from "../../systems/PuzzleWiring";

const LEVER_WIDTH = 14;
const LEVER_HEIGHT = 50;
const PULL_HOLD_MS = 350; // how long grab must be held before the lever flips
const LEVER_TWEEN_MS = 180;
const ON_ROTATION = 0.6; // radians
const OFF_ROTATION = -0.6;

// Bite-and-pull: hold grab near the lever for PULL_HOLD_MS to flip it once,
// toggling every registered target. Release and re-grab to pull it back the
// other way — there's no continuous drag like Crate, just a discrete switch.
// speedMultiplier is 0 (not Crate's partial slow) because pulling a lever
// plants Lexi in place rather than letting her walk off mid-pull.
export class Lever implements Grabbable {
  readonly kind = "lever" as const;
  readonly gameObject: Phaser.GameObjects.Rectangle;
  readonly speedMultiplier = 0;

  private readonly scene: Phaser.Scene;
  private readonly registry: PuzzleRegistry;
  private readonly targetIds: string[];
  private isOn = false;
  private pullTimerMs = 0;
  private toggledThisHold = false;

  constructor(scene: Phaser.Scene, x: number, y: number, targetIds: string[], registry: PuzzleRegistry) {
    this.scene = scene;
    this.targetIds = targetIds;
    this.registry = registry;

    this.gameObject = scene.add.rectangle(x, y, LEVER_WIDTH, LEVER_HEIGHT, 0x555555);
    this.gameObject.setOrigin(0.5, 1);
    this.gameObject.rotation = OFF_ROTATION;
  }

  get isActivated(): boolean {
    return this.isOn;
  }

  onGrab(_holder: Lexi): void {
    this.pullTimerMs = 0;
    this.toggledThisHold = false;
  }

  onHeldUpdate(_holder: Lexi, deltaSeconds: number): void {
    if (this.toggledThisHold) {
      return;
    }
    this.pullTimerMs += deltaSeconds * 1000;
    if (this.pullTimerMs >= PULL_HOLD_MS) {
      this.toggle();
      this.toggledThisHold = true;
    }
  }

  onRelease(_holder: Lexi): void {
    this.pullTimerMs = 0;
    this.toggledThisHold = false;
  }

  private toggle(): void {
    this.isOn = !this.isOn;
    this.scene.tweens.killTweensOf(this.gameObject);
    this.scene.tweens.add({
      targets: this.gameObject,
      rotation: this.isOn ? ON_ROTATION : OFF_ROTATION,
      duration: LEVER_TWEEN_MS,
      ease: "Back.Out",
    });
    this.registry.activate(this.targetIds, this.isOn);
  }
}
