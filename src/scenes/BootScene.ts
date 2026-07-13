import Phaser from "phaser";
import { DEBUG } from "../debug/flag";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    const { width, height } = this.cameras.main;

    const barWidth = 320;
    const barHeight = 24;
    const barX = width / 2 - barWidth / 2;
    const barY = height / 2 - barHeight / 2;

    const outline = this.add.graphics();
    outline.lineStyle(2, 0x555555, 1);
    outline.strokeRect(barX, barY, barWidth, barHeight);

    const bar = this.add.graphics();

    this.load.on("progress", (value: number) => {
      bar.clear();
      bar.fillStyle(0xdddddd, 1);
      bar.fillRect(barX + 2, barY + 2, (barWidth - 4) * value, barHeight - 4);
    });

    // No real assets yet — Phase 0 has nothing to preload. The bar still
    // exists so BootScene has somewhere to grow into once art lands.
  }

  create(): void {
    // DEBUG keeps the P0.3 default (GameScene's own test-room fallback) so
    // the fast dev-iteration loop (digit keys -> test rooms) every prior
    // phase's verify step relies on doesn't gain a menu/cutscene in front of
    // it. Production follows the real flow: the title screen (PROMPTS
    // P5.1) — Continue/New Game there own the intro-vs-straight-to-Chapter-1
    // decision (MenuScene.hasSave), not BootScene.
    if (DEBUG) {
      this.scene.start("Game");
      return;
    }

    this.scene.start("Menu");
  }
}
