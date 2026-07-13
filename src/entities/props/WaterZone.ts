import Phaser from "phaser";

// Pure geometry plus a current vector — no physics body of its own. Lexi
// reads contains()/currentVx each frame and applies the swim/current effect
// to her own body, the same way held-weight and sniff already modify her
// move speed, rather than the zone reaching into her.
export class WaterZone {
  readonly gameObject: Phaser.GameObjects.Rectangle;
  readonly currentVx: number;

  private readonly bounds: Phaser.Geom.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, currentVx: number) {
    this.currentVx = currentVx;
    this.bounds = new Phaser.Geom.Rectangle(x - width / 2, y - height / 2, width, height);

    this.gameObject = scene.add.rectangle(x, y, width, height, 0x1a2a33, 0.55);
    scene.add.rectangle(x, y - height / 2, width, 3, 0x4a6a77, 0.8);
  }

  contains(x: number, y: number): boolean {
    return Phaser.Geom.Rectangle.Contains(this.bounds, x, y);
  }
}
