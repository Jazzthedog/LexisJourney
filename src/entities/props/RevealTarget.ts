import Phaser from "phaser";
import type { Targetable } from "../../systems/PuzzleWiring";

type Revealable = Phaser.GameObjects.GameObject & {
  setVisible(visible: boolean): unknown;
};

// Wraps any hidden game object (a buried Ball, say) so a Lever/PressurePlate/
// DigSpot's `targets` wiring can reveal it — setActivated(true) shows it and
// re-enables its body. The general-purpose Targetable counterpart to how
// Gate reveals a passage; exists for P3.1's data-driven levels, where a
// Tiled author needs a generic "make this visible and solid" target rather
// than one hardcoded per room the way test rooms wired dig reveals inline.
export class RevealTarget implements Targetable {
  readonly targetId: string;
  private readonly gameObject: Revealable;

  constructor(gameObject: Revealable, targetId: string) {
    this.gameObject = gameObject;
    this.targetId = targetId;
  }

  setActivated(activated: boolean): void {
    this.gameObject.setVisible(activated);
    const body = (this.gameObject as unknown as { body?: Phaser.Physics.Arcade.Body }).body;
    if (body) {
      body.enable = activated;
    }
  }
}
