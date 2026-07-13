import Phaser from "phaser";
import { InputMap } from "./InputMap";

const SWIPE_UP_THRESHOLD_PX = 40; // how far a touch must travel upward to count as "swipe up"
const JUMP_PULSE_MS = 80; // how long a detected swipe holds the virtual jump button
const ZONE_ALPHA = 0.14;
const BUTTON_ALPHA = 0.18;
const BUTTON_RADIUS = 46;

interface MoveZoneState {
  pointerId: number | null;
  startX: number;
  startY: number;
}

// PROMPTS P5.1: "left zone = move, swipe up = jump, buttons for bark/sniff"
// — plus grab and dig, which aren't in that list but Chapter 1 is not
// completable without them (the map2 crate-boost and map5 fence dig both
// require them), so a phone player following the verify step's "no
// instructions" bar needs some way to trigger them.
export class TouchControls {
  private readonly scene: Phaser.Scene;
  private readonly inputMap: InputMap;
  private readonly moveZone: MoveZoneState = { pointerId: null, startX: 0, startY: 0 };
  private jumpPulseRemainingMs = 0;
  private readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, inputMap: InputMap) {
    this.scene = scene;
    this.inputMap = inputMap;

    const { width, height } = scene.scale;
    const moveZoneRect = scene.add
      .rectangle(width * 0.22, height - 110, width * 0.44, 220, 0xffffff, ZONE_ALPHA)
      .setScrollFactor(0)
      .setDepth(900);

    const barkButton = this.buildButton(width - 170, height - 70, "bark");
    const sniffButton = this.buildButton(width - 90, height - 150, "sniff");
    const grabButton = this.buildButton(width - 250, height - 70, "grab");
    const digButton = this.buildButton(width - 170, height - 150, "dig");

    this.container = scene.add.container(0, 0, [moveZoneRect, barkButton, sniffButton, grabButton, digButton]);
    this.container.setDepth(900);

    scene.input.on("pointerdown", this.onPointerDown, this);
    scene.input.on("pointermove", this.onPointerMove, this);
    scene.input.on("pointerup", this.onPointerUp, this);
    scene.input.on("pointerupoutside", this.onPointerUp, this);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  // Cheap, standard touch-capability check — matches the rest of this
  // project's "behind mobile detection" gating (PROMPTS P5.1), not a UA
  // sniff, so it also lights up correctly on a touch-enabled laptop.
  static shouldShow(scene: Phaser.Scene): boolean {
    return !!scene.sys.game.device.input.touch;
  }

  update(deltaSeconds: number): void {
    if (this.jumpPulseRemainingMs > 0) {
      this.jumpPulseRemainingMs -= deltaSeconds * 1000;
      if (this.jumpPulseRemainingMs <= 0) {
        this.inputMap.setVirtualJump(false);
      }
    }
  }

  destroy(): void {
    this.scene.input.off("pointerdown", this.onPointerDown, this);
    this.scene.input.off("pointermove", this.onPointerMove, this);
    this.scene.input.off("pointerup", this.onPointerUp, this);
    this.scene.input.off("pointerupoutside", this.onPointerUp, this);
    this.container.destroy();
  }

  private buildButton(x: number, y: number, kind: "bark" | "sniff" | "grab" | "dig"): Phaser.GameObjects.Container {
    const circle = this.scene.add.circle(0, 0, BUTTON_RADIUS, 0xffffff, BUTTON_ALPHA);
    const label = this.scene.add
      .text(0, 0, kind[0].toUpperCase(), { fontFamily: "monospace", fontSize: "20px", color: "#ffffff" })
      .setOrigin(0.5);
    const btn = this.scene.add.container(x, y, [circle, label]);
    circle.setInteractive({ useHandCursor: false });

    circle.on("pointerdown", () => this.onButtonDown(kind));
    circle.on("pointerup", () => this.onButtonUp(kind));
    circle.on("pointerupoutside", () => this.onButtonUp(kind));
    return btn;
  }

  private onButtonDown(kind: "bark" | "sniff" | "grab" | "dig"): void {
    switch (kind) {
      case "bark":
        this.inputMap.setVirtualBark(true);
        break;
      case "sniff":
        this.inputMap.setVirtualSniff(true);
        break;
      case "grab":
        this.inputMap.setVirtualGrab(true);
        break;
      case "dig":
        this.inputMap.setVirtualDig(true);
        break;
    }
  }

  private onButtonUp(kind: "bark" | "sniff" | "grab" | "dig"): void {
    switch (kind) {
      case "bark":
        this.inputMap.setVirtualBark(false);
        break;
      case "sniff":
        this.inputMap.setVirtualSniff(false);
        break;
      case "grab":
        this.inputMap.setVirtualGrab(false);
        break;
      case "dig":
        this.inputMap.setVirtualDig(false);
        break;
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.moveZone.pointerId !== null) {
      return; // one finger drives the move zone at a time
    }
    if (pointer.x > this.scene.scale.width * 0.5) {
      return; // right half is buttons, handled by their own pointerdown
    }
    this.moveZone.pointerId = pointer.id;
    this.moveZone.startX = pointer.x;
    this.moveZone.startY = pointer.y;
    this.applyMoveX(pointer.x);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.moveZone.pointerId) {
      return;
    }
    this.applyMoveX(pointer.x);

    if (this.moveZone.startY - pointer.y > SWIPE_UP_THRESHOLD_PX) {
      this.inputMap.setVirtualJump(true);
      this.jumpPulseRemainingMs = JUMP_PULSE_MS;
      // Re-base so continuing to hold the swipe doesn't re-trigger every
      // frame once past the threshold — one swipe, one jump pulse.
      this.moveZone.startY = pointer.y;
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.moveZone.pointerId) {
      return;
    }
    this.moveZone.pointerId = null;
    this.inputMap.setVirtualMoveX(0);
  }

  private applyMoveX(pointerX: number): void {
    // Split the move zone itself into left/right halves rather than a true
    // analog stick — simpler to build and to verify, and matches "always
    // runs" (SPEC §3: no walk/run speed variation to control anyway).
    const zoneCenter = this.scene.scale.width * 0.22;
    this.inputMap.setVirtualMoveX(pointerX < zoneCenter ? -1 : 1);
  }
}
