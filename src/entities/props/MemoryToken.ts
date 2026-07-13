import Phaser from "phaser";

const TOKEN_RADIUS = 9;
const TOKEN_COLOR = 0xaa3333; // SPEC §4's one accent hue — every family clue reads as "this matters"
const PULSE_MS = 900;
const PULSE_MIN_SCALE = 0.85;
const PULSE_MAX_SCALE = 1.15;

// A collectible Memory Token — SPEC §2's family objects (ball, scarf,
// poster...). No physics body: like DigSpot/SoundReactive, it's a dumb
// marker the room/ClueSystem checks by position, not something Lexi
// collides with. `id` is the stable string SaveSystem persists under.
export class MemoryToken {
  readonly gameObject: Phaser.GameObjects.Ellipse;
  readonly id: string;
  private collected = false;

  constructor(scene: Phaser.Scene, x: number, y: number, id: string) {
    this.id = id;
    this.gameObject = scene.add.ellipse(x, y, TOKEN_RADIUS * 2, TOKEN_RADIUS * 2, TOKEN_COLOR);

    scene.tweens.add({
      targets: this.gameObject,
      scale: { from: PULSE_MIN_SCALE, to: PULSE_MAX_SCALE },
      duration: PULSE_MS,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  get isCollected(): boolean {
    return this.collected;
  }

  // Called both for a fresh pickup and to restore an already-collected
  // token from a prior session (SaveSystem) — either way it just vanishes.
  markCollected(): void {
    if (this.collected) {
      return;
    }
    this.collected = true;
    this.scene.tweens.killTweensOf(this.gameObject);
    this.gameObject.setVisible(false);
  }

  private get scene(): Phaser.Scene {
    return this.gameObject.scene;
  }
}
