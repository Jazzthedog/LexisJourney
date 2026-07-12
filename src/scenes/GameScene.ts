import Phaser from "phaser";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("Game");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x1a1a1a);
  }
}
