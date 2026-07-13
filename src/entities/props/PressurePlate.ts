import Phaser from "phaser";
import type { PuzzleRegistry } from "../../systems/PuzzleWiring";

const PLATE_WIDTH_INSET = 6; // visual plate slightly narrower than its sensor footprint
const PLATE_HEIGHT = 8;
const SENSOR_HEIGHT = 26; // tall enough to catch a body resting flush on the plate's top edge
const IDLE_COLOR = 0x3a3a3a;
const PRESSED_COLOR = 0x707050;

// A ground-level sensor, not a physics body of its own — it sits flush on
// top of the room's existing solid ground the same way DigSpot does, and
// checks overlap against candidate bodies every frame rather than colliding.
// Continuous, unlike Lever's discrete toggle: activation tracks weight
// exactly, dropping the instant nothing is left resting on it.
export class PressurePlate {
  readonly gameObject: Phaser.GameObjects.Rectangle;

  private readonly registry: PuzzleRegistry;
  private readonly targetIds: string[];
  private readonly sensorBounds: Phaser.Geom.Rectangle;
  private weighted = false;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, targetIds: string[], registry: PuzzleRegistry) {
    this.registry = registry;
    this.targetIds = targetIds;

    this.gameObject = scene.add.rectangle(x, y, width - PLATE_WIDTH_INSET, PLATE_HEIGHT, IDLE_COLOR);
    this.sensorBounds = new Phaser.Geom.Rectangle(x - width / 2, y - SENSOR_HEIGHT, width, SENSOR_HEIGHT);
  }

  get isWeighted(): boolean {
    return this.weighted;
  }

  update(candidateBodies: Phaser.Physics.Arcade.Body[]): void {
    const nowWeighted = candidateBodies.some((body) =>
      Phaser.Geom.Intersects.RectangleToRectangle(
        this.sensorBounds,
        new Phaser.Geom.Rectangle(body.position.x, body.position.y, body.width, body.height),
      ),
    );

    if (nowWeighted === this.weighted) {
      return;
    }
    this.weighted = nowWeighted;
    this.gameObject.setFillStyle(nowWeighted ? PRESSED_COLOR : IDLE_COLOR);
    this.registry.activate(this.targetIds, nowWeighted);
  }
}
