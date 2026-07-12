import Phaser from "phaser";
import type { Lexi } from "../Lexi";

// A single concrete "thing you can dig at" — the room decides what digging
// it actually does (reveal a buried item, open a passage) via the callback,
// so DigSpot itself stays a dumb, reusable trigger zone.
export class DigSpot {
  readonly gameObject: Phaser.GameObjects.Rectangle;
  private dug = false;
  private readonly onDigCallback: (digger: Lexi) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, onDigCallback: (digger: Lexi) => void) {
    this.gameObject = scene.add.rectangle(x, y, width, 10, 0x3a2a1a, 0.5);
    this.onDigCallback = onDigCallback;
  }

  get isDug(): boolean {
    return this.dug;
  }

  onDig(digger: Lexi): void {
    if (this.dug) {
      return;
    }
    this.dug = true;
    this.gameObject.setFillStyle(0x18100a, 0.85);
    this.onDigCallback(digger);
  }
}
