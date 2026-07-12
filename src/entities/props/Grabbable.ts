import Phaser from "phaser";
import type { Lexi } from "../Lexi";

// Shared contract for anything Lexi's GRAB state can attach to. "drag"
// props (crates) get pushed along the ground and slow Lexi down by weight;
// "carry" props (small items) ride in her mouth with no speed penalty.
export type GrabbableKind = "drag" | "carry";

export interface Grabbable {
  readonly kind: GrabbableKind;
  readonly gameObject: Phaser.GameObjects.GameObject & { x: number; y: number };
  /** Run-speed multiplier applied to Lexi while this is held (1 = no penalty). */
  readonly speedMultiplier: number;
  onGrab(holder: Lexi): void;
  onHeldUpdate(holder: Lexi, deltaSeconds: number): void;
  onRelease(holder: Lexi): void;
}
