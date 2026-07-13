import Phaser from "phaser";
import { TEST_ROOMS } from "./TestRooms";

// Module-level, not per-instance: the overlay's on/off state should survive
// a scene.restart() when jumping between test rooms, since restart tears
// down and reconstructs the whole scene (and this harness with it).
let overlayVisible = false;

const DIGIT_KEY_NAMES: Record<string, string> = {
  "1": "ONE",
  "2": "TWO",
  "3": "THREE",
  "4": "FOUR",
  "5": "FIVE",
  "6": "SIX",
  "7": "SEVEN",
  "8": "EIGHT",
  "9": "NINE",
};

interface DebuggablePlayer {
  getDebugState?: () => string;
}

// A scene is currently running either a hand-built debug room (P0.3) or a
// Tiled-loaded map (P3.1) — restart/display behavior differs slightly per
// kind, but the overlay itself doesn't care which.
export type SceneIdentity = { kind: "room"; key: string } | { kind: "map"; key: string };

export class DebugHarness {
  private scene: Phaser.Scene;
  private identity: SceneIdentity;
  private overlay: Phaser.GameObjects.Text;
  private freeFly = false;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(scene: Phaser.Scene, identity: SceneIdentity) {
    this.scene = scene;
    this.identity = identity;

    this.overlay = scene.add
      .text(12, 12, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#00ff88",
        backgroundColor: "#000000aa",
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(1000)
      .setVisible(overlayVisible);

    scene.physics.world.createDebugGraphic();
    scene.physics.world.drawDebug = overlayVisible;
    if (!overlayVisible) {
      scene.physics.world.debugGraphic.clear();
    }

    this.cursors = scene.input.keyboard?.createCursorKeys();

    scene.input.keyboard?.on("keydown-BACKTICK", () => this.toggleOverlay());
    scene.input.keyboard?.on("keydown-R", () => this.restartRoom());
    scene.input.keyboard?.on("keydown-F", () => this.toggleFreeFly());

    for (const room of TEST_ROOMS) {
      const keyName = DIGIT_KEY_NAMES[room.key];
      if (keyName) {
        scene.input.keyboard?.on(`keydown-${keyName}`, () => this.jumpToRoom(room.key));
      }
    }
  }

  update(deltaSeconds: number): void {
    if (this.freeFly) {
      this.panCamera(deltaSeconds);
    }

    if (!overlayVisible) {
      return;
    }

    const fps = Math.round(this.scene.game.loop.actualFps);
    const roomName =
      this.identity.kind === "map" ? `map:${this.identity.key}` : (TEST_ROOMS.find((r) => r.key === this.identity.key)?.name ?? "?");
    const rooms = TEST_ROOMS.map((r) => `${r.key}:${r.name}`).join("  ");

    this.overlay.setText(
      [
        `FPS: ${fps}`,
        `Room: ${roomName}${this.freeFly ? "  [FREE-FLY]" : ""}`,
        `Lexi: ${this.getPlayerStateLabel()}`,
        `\` overlay  |  R restart room  |  F free-fly  |  ${rooms}`,
      ].join("\n"),
    );
  }

  private getPlayerStateLabel(): string {
    const lexi = (this.scene as unknown as { lexi?: DebuggablePlayer }).lexi;
    return lexi?.getDebugState?.() ?? "no player yet";
  }

  private toggleOverlay(): void {
    overlayVisible = !overlayVisible;
    this.overlay.setVisible(overlayVisible);
    this.scene.physics.world.drawDebug = overlayVisible;
    if (!overlayVisible) {
      this.scene.physics.world.debugGraphic.clear();
    }
  }

  private restartRoom(): void {
    // Rebuilds the current room/map fresh from its own start state — a
    // CheckpointSystem-driven fail (P2.2+) is the in-fiction equivalent for
    // rooms/maps that use one; this is the blunt "start over" fallback.
    if (this.identity.kind === "map") {
      this.scene.scene.restart({ map: this.identity.key });
    } else {
      this.scene.scene.restart({ room: this.identity.key });
    }
  }

  private jumpToRoom(key: string): void {
    if ((this.identity.kind === "room" && key === this.identity.key) || !TEST_ROOMS.some((r) => r.key === key)) {
      return;
    }
    this.scene.scene.restart({ room: key });
  }

  private toggleFreeFly(): void {
    this.freeFly = !this.freeFly;
  }

  private panCamera(deltaSeconds: number): void {
    if (!this.cursors) {
      return;
    }

    const speed = 500 * deltaSeconds;
    const cam = this.scene.cameras.main;

    if (this.cursors.left.isDown) cam.scrollX -= speed;
    if (this.cursors.right.isDown) cam.scrollX += speed;
    if (this.cursors.up.isDown) cam.scrollY -= speed;
    if (this.cursors.down.isDown) cam.scrollY += speed;
  }
}
