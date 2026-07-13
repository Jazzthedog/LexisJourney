import Phaser from "phaser";

// A rectangle sensor that fires once on the frame a body's center enters it,
// re-arming only after that body leaves. Same "walked into it" shape for
// both checkpoint markers and fail hazards — only the callback differs.
export class TriggerZone {
  readonly gameObject: Phaser.GameObjects.Rectangle;

  private readonly bounds: Phaser.Geom.Rectangle;
  private readonly onEnter: () => void;
  private inside = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    onEnter: () => void,
    color = 0x000000,
    alpha = 0,
  ) {
    this.onEnter = onEnter;
    this.bounds = new Phaser.Geom.Rectangle(x - width / 2, y - height / 2, width, height);
    this.gameObject = scene.add.rectangle(x, y, width, height, color, alpha);
  }

  update(body: Phaser.Physics.Arcade.Body): void {
    const nowInside = Phaser.Geom.Rectangle.Contains(this.bounds, body.center.x, body.center.y);
    if (nowInside && !this.inside) {
      this.onEnter();
    }
    this.inside = nowInside;
  }
}
