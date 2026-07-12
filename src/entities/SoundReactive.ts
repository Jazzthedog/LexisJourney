import Phaser from "phaser";

// Anything Lexi's bark can notify — creatures now, sound-reactive props
// (alarms, machinery) later. Lexi does the radius check; onBark just reacts.
export interface SoundReactive {
  readonly gameObject: Phaser.GameObjects.GameObject & { x: number; y: number };
  onBark(originX: number, originY: number): void;
}
