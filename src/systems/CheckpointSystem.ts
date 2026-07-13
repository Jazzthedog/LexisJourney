import Phaser from "phaser";

// Anything a checkpoint should snapshot and be able to roll back: Lexi
// herself, and whatever movable props a room registers (a dragged crate,
// etc.) so a fail doesn't just move Lexi back while leaving the rest of the
// world in a state she couldn't have reached honestly.
export interface Snapshottable<T = unknown> {
  captureSnapshot(): T;
  restoreSnapshot(snapshot: T): void;
}

const FADE_MS = 350; // fade-out; the out+in round trip stays comfortably under PROMPTS' <1s budget

export class CheckpointSystem {
  private readonly scene: Phaser.Scene;
  private readonly entries: Snapshottable[] = [];
  private snapshot: unknown[] = [];
  private restoring = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  register(target: Snapshottable): void {
    this.entries.push(target);
  }

  checkpoint(): void {
    this.snapshot = this.entries.map((entry) => entry.captureSnapshot());
  }

  fail(onRestored?: () => void): void {
    if (this.restoring) {
      return;
    }
    this.restoring = true;

    const cam = this.scene.cameras.main;
    cam.fade(FADE_MS, 0, 0, 0, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress < 1) {
        return;
      }
      this.entries.forEach((entry, i) => entry.restoreSnapshot(this.snapshot[i]));
      cam.fadeIn(FADE_MS);
      this.restoring = false;
      onRestored?.();
    });
  }
}
