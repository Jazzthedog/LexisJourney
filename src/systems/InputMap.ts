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
  private keyE: Phaser.Input.Keyboard.Key;
  private keyQ: Phaser.Input.Keyboard.Key;
  private keyS: Phaser.Input.Keyboard.Key;

  private jumpDown = false;
  private jumpJustPressed = false;
  private jumpJustReleased = false;

  private grabDown = false;
  private grabJustPressed = false;

  private barkJustPressed = false;
  private wasBarkDown = false;

  private sniffDown = false;

  private digJustPressed = false;
  private wasDigDown = false;

  // Touch input (PROMPTS P5.1's TouchControls) — set by whatever's driving
  // it each frame, blended into the same isDown/moveX() reads as keyboard
  // and gamepad rather than a separate parallel path, so gameplay code
  // never has to know which input source is active.
  private virtualMoveX = 0;
  private virtualJumpDown = false;
  private virtualGrabDown = false;
  private virtualBarkDown = false;
  private virtualSniffDown = false;
  private virtualDigDown = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const keyboard = scene.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyE = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyQ = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.keyS = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
  }

  update(): void {
    const pad = this.scene.input.gamepad?.pad1;
    const padJumpDown = !!(pad && (pad.A || pad.buttons[0]?.pressed));
    const padGrabDown = !!(pad && (pad.X || pad.buttons[2]?.pressed));
    const padBarkDown = !!(pad && (pad.B || pad.buttons[1]?.pressed));
    const padSniffDown = !!(pad && pad.L2 > 0.5);
    const padDigDown = !!(pad && pad.down);

    const wasJumpDown = this.jumpDown;
    this.jumpDown = this.cursors.space.isDown || this.cursors.up.isDown || this.keyW.isDown || padJumpDown || this.virtualJumpDown;
    this.jumpJustPressed = this.jumpDown && !wasJumpDown;
    this.jumpJustReleased = !this.jumpDown && wasJumpDown;

    const wasGrabDown = this.grabDown;
    this.grabDown =
      this.keyE.isDown || (this.cursors.down.isDown && (this.cursors.left.isDown || this.cursors.right.isDown)) || padGrabDown || this.virtualGrabDown;
    this.grabJustPressed = this.grabDown && !wasGrabDown;

    const barkDown = this.keyQ.isDown || padBarkDown || this.virtualBarkDown;
    this.barkJustPressed = barkDown && !this.wasBarkDown;
    this.wasBarkDown = barkDown;

    this.sniffDown = this.cursors.shift.isDown || padSniffDown || this.virtualSniffDown;

    const digDown = this.keyS.isDown || padDigDown || this.virtualDigDown;
    this.digJustPressed = digDown && !this.wasDigDown;
    this.wasDigDown = digDown;
  }

  // Called by TouchControls each frame while a virtual button/zone is held —
  // "just pressed" edges for these come free from the same isDown blending
  // in update() above, so TouchControls never needs its own edge-detection.
  setVirtualJump(down: boolean): void {
    this.virtualJumpDown = down;
  }

  setVirtualGrab(down: boolean): void {
    this.virtualGrabDown = down;
  }

  setVirtualBark(down: boolean): void {
    this.virtualBarkDown = down;
  }

  setVirtualSniff(down: boolean): void {
    this.virtualSniffDown = down;
  }

  setVirtualDig(down: boolean): void {
    this.virtualDigDown = down;
  }

  setVirtualMoveX(x: number): void {
    this.virtualMoveX = Phaser.Math.Clamp(x, -1, 1);
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

    if (x === 0 && this.virtualMoveX !== 0) {
      x = this.virtualMoveX;
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

  get isGrabDown(): boolean {
    return this.grabDown;
  }

  get isGrabJustPressed(): boolean {
    return this.grabJustPressed;
  }

  get isBarkJustPressed(): boolean {
    return this.barkJustPressed;
  }

  get isSniffDown(): boolean {
    return this.sniffDown;
  }

  get isDigJustPressed(): boolean {
    return this.digJustPressed;
  }
}
