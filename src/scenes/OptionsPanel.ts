import Phaser from "phaser";
import { SettingsSystem } from "../systems/SettingsSystem";

const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 300;
const SLIDER_TRACK_WIDTH = 220;
const SLIDER_HANDLE_RADIUS = 11;
const ROW_SPACING = 64;

// A reusable options UI (PROMPTS P5.1: "Options — volume sliders, grain
// toggle, high-contrast mode") built as a plain container-builder rather
// than its own Scene, since both MenuScene and the in-game pause menu need
// the identical controls and neither owns the other. It only ever mutates
// SettingsSystem (the single persisted source of truth) — applying a
// changed setting to whatever's currently live (AudioSystem's gain,
// GrainPipeline's uniforms) is the caller's job via `onChange`, since
// MenuScene and PauseScene each have different live instances on hand (or
// none, in MenuScene's case, before any level has loaded).
export class OptionsPanel {
  readonly container: Phaser.GameObjects.Container;
  private readonly settings: SettingsSystem;
  private readonly onChange: () => void;
  private readonly onClose: () => void;
  private volumeHandle!: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number, settings: SettingsSystem, onChange: () => void, onClose: () => void) {
    this.settings = settings;
    this.onChange = onChange;
    this.onClose = onClose;

    const backdrop = scene.add.rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0x000000, 0.82).setStrokeStyle(1, 0x444444);
    const title = scene.add.text(0, -PANEL_HEIGHT / 2 + 30, "OPTIONS", { fontFamily: "monospace", fontSize: "20px", color: "#ffffff" }).setOrigin(0.5);

    const volumeRow = this.buildVolumeRow(scene, -ROW_SPACING);
    const grainRow = this.buildToggleRow(scene, 0, "GRAIN", settings.grainEnabled, (next) => {
      settings.setGrainEnabled(next);
      this.onChange();
    });

    const contrastRow = this.buildToggleRow(scene, ROW_SPACING, "HIGH CONTRAST", settings.highContrast, (next) => {
      settings.setHighContrast(next);
      this.onChange();
    });

    const backButton = scene.add
      .text(0, PANEL_HEIGHT / 2 - 34, "[ BACK ]", { fontFamily: "monospace", fontSize: "16px", color: "#aaaaaa" })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    backButton.on("pointerdown", () => this.onClose());
    backButton.on("pointerover", () => backButton.setColor("#ffffff"));
    backButton.on("pointerout", () => backButton.setColor("#aaaaaa"));

    this.container = scene.add.container(x, y, [backdrop, title, volumeRow.row, grainRow.row, contrastRow.row, backButton]);
    this.container.setDepth(950);
    this.container.setScrollFactor(0);
  }

  destroy(): void {
    this.container.destroy();
  }

  private buildVolumeRow(scene: Phaser.Scene, offsetY: number): { row: Phaser.GameObjects.Container } {
    const label = scene.add.text(-PANEL_WIDTH / 2 + 30, offsetY, "VOLUME", { fontFamily: "monospace", fontSize: "15px", color: "#cccccc" }).setOrigin(0, 0.5);

    const trackX = 40;
    const track = scene.add.rectangle(trackX, offsetY, SLIDER_TRACK_WIDTH, 4, 0x555555).setOrigin(0, 0.5);
    const handleX = trackX + this.settings.masterVolume * SLIDER_TRACK_WIDTH;
    this.volumeHandle = scene.add.circle(handleX, offsetY, SLIDER_HANDLE_RADIUS, 0xffffff);
    this.volumeHandle.setInteractive({ draggable: true, useHandCursor: true });
    scene.input.setDraggable(this.volumeHandle);

    this.volumeHandle.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number) => {
      const clampedX = Phaser.Math.Clamp(dragX, trackX, trackX + SLIDER_TRACK_WIDTH);
      this.volumeHandle.x = clampedX;
      const value = (clampedX - trackX) / SLIDER_TRACK_WIDTH;
      this.settings.setMasterVolume(value);
      this.onChange();
    });
    // Click-anywhere-on-track-to-set, not just drag-the-handle — friendlier
    // on a touchscreen where dragging a small handle precisely is fiddly.
    track.setInteractive({ useHandCursor: true });
    track.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const localX = pointer.x - (this.container?.x ?? 0);
      const clampedX = Phaser.Math.Clamp(localX, trackX, trackX + SLIDER_TRACK_WIDTH);
      this.volumeHandle.x = clampedX;
      const value = (clampedX - trackX) / SLIDER_TRACK_WIDTH;
      this.settings.setMasterVolume(value);
      this.onChange();
    });

    const row = scene.add.container(0, 0, [label, track, this.volumeHandle]);
    return { row };
  }

  private buildToggleRow(
    scene: Phaser.Scene,
    offsetY: number,
    labelText: string,
    initial: boolean,
    onToggle: (next: boolean) => void,
  ): { row: Phaser.GameObjects.Container; valueText: Phaser.GameObjects.Text } {
    const label = scene.add
      .text(-PANEL_WIDTH / 2 + 30, offsetY, labelText, { fontFamily: "monospace", fontSize: "15px", color: "#cccccc" })
      .setOrigin(0, 0.5);
    const valueText = scene.add
      .text(PANEL_WIDTH / 2 - 30, offsetY, initial ? "ON" : "OFF", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: initial ? "#88cc88" : "#888888",
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });

    let state = initial;
    valueText.on("pointerdown", () => {
      state = !state;
      valueText.setText(state ? "ON" : "OFF");
      valueText.setColor(state ? "#88cc88" : "#888888");
      onToggle(state);
    });

    const row = scene.add.container(0, 0, [label, valueText]);
    return { row, valueText };
  }
}
