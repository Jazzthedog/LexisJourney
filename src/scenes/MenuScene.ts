import Phaser from "phaser";
import { GrainPipeline } from "../fx/Grain";
import { FogLayers } from "../fx/Fog";
import { SaveSystem } from "../systems/SaveSystem";
import { SettingsSystem } from "../systems/SettingsSystem";
import { OptionsPanel } from "./OptionsPanel";

const FIRST_CHAPTER_MAP = "ch1_01_reststop";
const CHAPTER_NAMES = ["The Forest", "The Storm & The River", "The Junkyard & The Strays", "The Town", "Home Stretch"];

type MenuView = "main" | "chapters";

interface MenuItem {
  label: () => string;
  enabled: () => boolean;
  action: () => void;
}

// Title screen (PROMPTS P5.1): "title over slow fog, Continue/New/
// Chapters(locked)/Options." Reuses FogLayers/GrainPipeline verbatim (same
// setup as GameScene/IntroScene) so the mood is consistent from the very
// first frame, not just once gameplay starts.
export class MenuScene extends Phaser.Scene {
  private saveSystem!: SaveSystem;
  private settings!: SettingsSystem;
  private grain?: GrainPipeline;
  private fog?: FogLayers;
  private view: MenuView = "main";
  private selectedIndex = 0;
  private menuContainer!: Phaser.GameObjects.Container;
  private optionsPanel: OptionsPanel | null = null;

  constructor() {
    super("Menu");
  }

  create(): void {
    this.saveSystem = new SaveSystem();
    this.settings = new SettingsSystem();
    this.view = "main";
    // Continue is disabled with no save (SettingsSystem/SaveSystem are
    // fresh above) — land the keyboard cursor on the first *enabled* item
    // rather than index 0, or the initial render shows no highlight at all.
    this.selectedIndex = this.mainMenuItems().findIndex((item) => item.enabled());
    this.optionsPanel = null;

    this.cameras.main.setBackgroundColor(0x0a0a0a);
    this.fog = new FogLayers(this, this.scale.width, this.scale.height);
    this.setupGrain();

    this.add
      .text(this.scale.width / 2, this.scale.height * 0.28, "LEXI'S JOURNEY", {
        fontFamily: "monospace",
        fontSize: "48px",
        color: "#eeeeee",
      })
      .setOrigin(0.5);
    this.add
      .text(this.scale.width / 2, this.scale.height * 0.28 + 44, "a dog, finding her way home", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#888888",
      })
      .setOrigin(0.5);

    this.menuContainer = this.add.container(0, 0);
    this.renderView();

    this.input.keyboard?.on("keydown-UP", () => this.moveSelection(-1));
    this.input.keyboard?.on("keydown-DOWN", () => this.moveSelection(1));
    this.input.keyboard?.on("keydown-ENTER", () => this.activateSelected());
    this.input.keyboard?.on("keydown-SPACE", () => this.activateSelected());
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.view !== "main") {
        this.view = "main";
        this.selectedIndex = 0;
        this.renderView();
      }
    });
  }

  update(_time: number, delta: number): void {
    this.fog?.update(delta / 1000);
  }

  private mainMenuItems(): MenuItem[] {
    return [
      {
        label: () => "Continue",
        enabled: () => this.saveSystem.hasSave,
        action: () => this.scene.start("Game", { map: this.saveSystem.lastMap }),
      },
      {
        label: () => "New Game",
        enabled: () => true,
        action: () => {
          this.saveSystem.reset();
          this.scene.start("Intro");
        },
      },
      {
        label: () => "Chapters",
        enabled: () => true,
        action: () => {
          this.view = "chapters";
          this.selectedIndex = 0;
          this.renderView();
        },
      },
      {
        label: () => "Options",
        enabled: () => true,
        action: () => this.openOptions(),
      },
    ];
  }

  private renderView(): void {
    this.menuContainer.removeAll(true);

    if (this.view === "chapters") {
      this.renderChapterSelect();
      return;
    }

    const items = this.mainMenuItems();
    items.forEach((item, i) => {
      const enabled = item.enabled();
      const text = this.add
        .text(this.scale.width / 2, this.scale.height * 0.52 + i * 44, this.formatLabel(item.label(), enabled, i), {
          fontFamily: "monospace",
          fontSize: "22px",
          color: enabled ? (i === this.selectedIndex ? "#ffffff" : "#aaaaaa") : "#555555",
        })
        .setOrigin(0.5);
      if (enabled) {
        text.setInteractive({ useHandCursor: true });
        text.on("pointerover", () => {
          this.selectedIndex = i;
          this.renderView();
        });
        text.on("pointerdown", () => item.action());
      }
      this.menuContainer.add(text);
    });
  }

  private renderChapterSelect(): void {
    const title = this.add
      .text(this.scale.width / 2, this.scale.height * 0.4, "CHAPTERS", { fontFamily: "monospace", fontSize: "24px", color: "#ffffff" })
      .setOrigin(0.5);
    this.menuContainer.add(title);

    CHAPTER_NAMES.forEach((name, i) => {
      const unlocked = i === 0; // only Chapter 1 exists (PROMPTS P5.1: "Chapters(locked)")
      const label = `${i + 1}. ${name}${unlocked ? "" : "  [locked]"}`;
      const text = this.add
        .text(this.scale.width / 2, this.scale.height * 0.5 + i * 40, label, {
          fontFamily: "monospace",
          fontSize: "18px",
          color: unlocked ? "#dddddd" : "#4a4a4a",
        })
        .setOrigin(0.5);
      if (unlocked) {
        text.setInteractive({ useHandCursor: true });
        text.on("pointerdown", () => this.scene.start("Game", { map: FIRST_CHAPTER_MAP }));
      }
      this.menuContainer.add(text);
    });

    const back = this.add
      .text(this.scale.width / 2, this.scale.height * 0.5 + CHAPTER_NAMES.length * 40 + 20, "[ BACK ]", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#aaaaaa",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on("pointerdown", () => {
      this.view = "main";
      this.selectedIndex = 0;
      this.renderView();
    });
    this.menuContainer.add(back);
  }

  private formatLabel(label: string, enabled: boolean, index: number): string {
    const prefix = enabled && index === this.selectedIndex ? "> " : "  ";
    return `${prefix}${label}`;
  }

  private moveSelection(delta: number): void {
    if (this.view !== "main") {
      return;
    }
    const items = this.mainMenuItems();
    let next = this.selectedIndex;
    for (let i = 0; i < items.length; i++) {
      next = (next + delta + items.length) % items.length;
      if (items[next].enabled()) {
        break;
      }
    }
    this.selectedIndex = next;
    this.renderView();
  }

  private activateSelected(): void {
    if (this.view !== "main") {
      return;
    }
    const item = this.mainMenuItems()[this.selectedIndex];
    if (item?.enabled()) {
      item.action();
    }
  }

  private openOptions(): void {
    if (this.optionsPanel) {
      return;
    }
    this.menuContainer.setVisible(false);
    this.optionsPanel = new OptionsPanel(
      this,
      this.scale.width / 2,
      this.scale.height / 2,
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
    this.grain?.setGrainEnabled(this.settings.grainEnabled);
    this.grain?.setHighContrast(this.settings.highContrast);
  }

  private setupGrain(): void {
    if (this.game.renderer.type !== Phaser.WEBGL) {
      return;
    }
    const pipelines = (this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).pipelines;
    if (!pipelines.has("Grain")) {
      pipelines.addPostPipeline("Grain", GrainPipeline);
    }
    this.cameras.main.setPostPipeline("Grain");
    this.grain = this.cameras.main.getPostPipeline("Grain") as GrainPipeline;
    this.grain.setGrainEnabled(this.settings.grainEnabled);
    this.grain.setHighContrast(this.settings.highContrast);
  }
}
