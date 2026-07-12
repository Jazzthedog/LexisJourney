import Phaser from "phaser";

const STICK_DEADZONE = 0.2;

// Wraps keyboard + gamepad into one small surface so gameplay code never
// touches Phaser's input APIs directly. Call update() once per frame (before
// reading isJumpJustPressed/isJumpJustReleased) so edge-detection is correct.
export class InputMap {
  private scene: Phaser.Scene;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA: Phaser.Input.Keyboard.Key;
  private keyD: Phaser.Input.Keyboard.Key;
  private keyW: Phaser.Input.Keyboard.Key;

  private jumpDown = false;
  private jumpJustPressed = false;
  private jumpJustReleased = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const keyboard = scene.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
  }

  update(): void {
    const pad = this.scene.input.gamepad?.pad1;
    const padJumpDown = !!(pad && (pad.A || pad.buttons[0]?.pressed));
    const wasDown = this.jumpDown;

    this.jumpDown = this.cursors.space.isDown || this.cursors.up.isDown || this.keyW.isDown || padJumpDown;
    this.jumpJustPressed = this.jumpDown && !wasDown;
    this.jumpJustReleased = !this.jumpDown && wasDown;
  }

  moveX(): number {
    let x = 0;
    if (this.cursors.left.isDown || this.keyA.isDown) x -= 1;
    if (this.cursors.right.isDown || this.keyD.isDown) x += 1;

    if (x === 0) {
      const stickX = this.scene.input.gamepad?.pad1?.leftStick.x ?? 0;
      if (Math.abs(stickX) > STICK_DEADZONE) {
        x = Phaser.Math.Clamp(stickX, -1, 1);
      }
    }

    return x;
  }

  get isJumpDown(): boolean {
    return this.jumpDown;
  }

  get isJumpJustPressed(): boolean {
    return this.jumpJustPressed;
  }

  get isJumpJustReleased(): boolean {
    return this.jumpJustReleased;
  }
}
