import Phaser from "phaser";
import { SettingsSystem } from "../systems/SettingsSystem";
import { OptionsPanel } from "./OptionsPanel";
import type { GameScene } from "./GameScene";

interface PauseSceneData {
  gameSceneKey: string;
}

// PROMPTS P5.1's in-game pause menu: "resume, restart checkpoint, options,
// quit to menu." A separate overlay Scene (launched on top of a *paused*
// GameScene, per SPEC §5's UIScene-as-overlay architecture) rather than a
// container drawn inside GameScene itself — that way GameScene's own
// update() genuinely stops (see the openPause()/resume() split with
// physics.pause()/resume(), matching the established "pausing gameplay
// means the physics world itself" lesson from ClueSystem/P3.2) without the
// pause menu's own input handling needing to fight over it.
export class PauseScene extends Phaser.Scene {
  private settings!: SettingsSystem;
  private gameSceneKey = "Game";
  private optionsPanel: OptionsPanel | null = null;
  private menuContainer!: Phaser.GameObjects.Container;

  constructor() {
    super("Pause");
  }

  create(data: PauseSceneData): void {
    this.gameSceneKey = data.gameSceneKey ?? "Game";
    this.settings = new SettingsSystem();
    this.optionsPanel = null;

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6).setDepth(800);
    this.add
      .text(width / 2, height * 0.3, "PAUSED", { fontFamily: "monospace", fontSize: "32px", color: "#ffffff" })
      .setOrigin(0.5)
      .setDepth(900);

    this.menuContainer = this.add.container(0, 0);
    this.menuContainer.setDepth(900);
    this.buildMenu();

    this.input.keyboard?.on("keydown-ESC", () => {
      if (!this.optionsPanel) {
        this.resume();
      }
    });
  }

  private buildMenu(): void {
    this.menuContainer.removeAll(true);
    const items: { label: string; action: () => void }[] = [
      { label: "Resume", action: () => this.resume() },
      { label: "Restart at Checkpoint", action: () => this.restartAtCheckpoint() },
      { label: "Options", action: () => this.openOptions() },
      { label: "Quit to Menu", action: () => this.quitToMenu() },
    ];

    items.forEach((item, i) => {
      const text = this.add
        .text(this.scale.width / 2, this.scale.height * 0.45 + i * 46, item.label, {
          fontFamily: "monospace",
          fontSize: "22px",
          color: "#dddddd",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      text.on("pointerover", () => text.setColor("#ffffff"));
      text.on("pointerout", () => text.setColor("#dddddd"));
      text.on("pointerdown", item.action);
      this.menuContainer.add(text);
    });
  }

  private resume(): void {
    const gameScene = this.scene.get(this.gameSceneKey);
    gameScene.physics.resume();
    this.scene.resume(this.gameSceneKey);
    this.scene.stop();
  }

  private restartAtCheckpoint(): void {
    (this.scene.get(this.gameSceneKey) as GameScene).restartCheckpoint();
    this.resume();
  }

  private quitToMenu(): void {
    this.scene.stop(this.gameSceneKey);
    this.scene.stop();
    this.scene.start("Menu");
  }

  private openOptions(): void {
    if (this.optionsPanel) {
      return;
    }
    this.menuContainer.setVisible(false);
    this.optionsPanel = new OptionsPanel(
      this,
      this.scale.width / 2,
      this.scale.height * 0.68,
      this.settings,
      () => this.applyLiveSettings(),
      () => {
        this.optionsPanel?.destroy();
        this.optionsPanel = null;
        this.menuContainer.setVisible(true);
      },
    );
  }

  private applyLiveSettings(): void {
    const gameScene = this.scene.get(this.gameSceneKey) as GameScene;
    gameScene.setMasterVolume(this.settings.masterVolume);
    gameScene.setHighContrast(this.settings.highContrast);
    const grain = gameScene.getGrainPipeline();
    grain?.setGrainEnabled(this.settings.grainEnabled);
    grain?.setHighContrast(this.settings.highContrast);
  }
}
