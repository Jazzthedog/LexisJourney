import Phaser from "phaser";
import { InputMap } from "../systems/InputMap";
import type { Grabbable } from "./props/Grabbable";

export enum LexiState {
  IDLE = "IDLE",
  RUN = "RUN",
  JUMP = "JUMP",
  FALL = "FALL",
  LAND = "LAND",
  GRAB = "GRAB",
}

// Tuning constants — this is the "feel" surface for P1.1. Iterate on these
// numbers, not the state machine shape, when adjusting how movement feels.
const MOVE_SPEED = 260; // px/s max run speed
const ACCELERATION = 1700; // px/s^2 ramp toward max run speed
const DECELERATION = 2200; // px/s^2 ramp toward a stop
const AIR_CONTROL_MULT = 0.7; // horizontal accel/decel scale while airborne
const JUMP_VELOCITY = -520; // px/s initial jump impulse
const JUMP_CUT_MULTIPLIER = 0.5; // vy retained if jump released early while still rising
const COYOTE_TIME_MS = 100;
const JUMP_BUFFER_MS = 120;
const LAND_SQUASH_MS = 90;
const IDLE_SPEED_THRESHOLD = 6; // px/s below which grounded counts as idle, not run
const GRAB_RANGE = 70; // px — how close a grabbable needs to be to attach on E press
// Arcade can report body.blocked.down=false for exactly one frame while
// resting (a horizontal-velocity change alone can trigger it, with no real
// separation from the ground — one frame of gravity slips through before
// collision resolution snaps it back). Require this many consecutive
// ungrounded frames before treating her as genuinely airborne.
const UNGROUNDED_DEBOUNCE_FRAMES = 2;

const BODY_WIDTH = 26;
const BODY_HEIGHT = 46;

export class Lexi extends Phaser.GameObjects.Container {
  declare body: Phaser.Physics.Arcade.Body;

  private inputMap: InputMap;
  private movementState: LexiState = LexiState.IDLE;
  private facing: 1 | -1 = 1;

  private coyoteTimerMs = 0;
  private jumpBufferTimerMs = 0;
  private jumpCutApplied = false;
  private wasGrounded = false;
  private ungroundedStreak = 0;
  private debouncedGrounded = false;

  private held: Grabbable | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, inputMap: InputMap) {
    super(scene, x, y);
    this.inputMap = inputMap;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(BODY_WIDTH, BODY_HEIGHT);
    this.body.setOffset(-BODY_WIDTH / 2, -BODY_HEIGHT / 2);
    this.body.setMaxVelocity(MOVE_SPEED * 1.6, 1000);
    this.body.setCollideWorldBounds(true);

    const capsule = scene.add.ellipse(0, 0, BODY_WIDTH, BODY_HEIGHT, 0x0a0a0a);
    const eyeFront = scene.add.ellipse(6, -14, 5, 5, 0xffffff);
    const eyeBack = scene.add.ellipse(6, -7, 5, 5, 0xffffff);
    const collar = scene.add.rectangle(5, -1, 15, 5, 0xaa3333);
    this.add([capsule, eyeFront, eyeBack, collar]);
  }

  get facingDirection(): 1 | -1 {
    return this.facing;
  }

  getDebugState(): string {
    const vx = Math.round(this.body.velocity.x);
    const vy = Math.round(this.body.velocity.y);
    const holding = this.held ? ` holding=${this.held.kind}` : "";
    return `${this.movementState} facing=${this.facing > 0 ? "R" : "L"} vx=${vx} vy=${vy} grounded=${this.debouncedGrounded}${holding}`;
  }

  update(deltaSeconds: number, grabCandidates: Grabbable[] = []): void {
    const grounded = this.computeDebouncedGrounded();
    this.debouncedGrounded = grounded;

    this.updateGrab(deltaSeconds, grabCandidates);
    this.updateTimers(deltaSeconds, grounded);
    this.updateHorizontal(deltaSeconds, grounded);
    this.updateJump(grounded);
    this.updateFacing();
    this.updateMovementState(grounded);

    this.wasGrounded = grounded;
  }

  private updateGrab(deltaSeconds: number, grabCandidates: Grabbable[]): void {
    if (!this.held && this.inputMap.isGrabJustPressed) {
      this.held = this.findNearestGrabbable(grabCandidates);
      this.held?.onGrab(this);
    }

    if (this.held) {
      if (this.inputMap.isGrabDown) {
        this.held.onHeldUpdate(this, deltaSeconds);
      } else {
        this.held.onRelease(this);
        this.held = null;
      }
    }
  }

  private findNearestGrabbable(candidates: Grabbable[]): Grabbable | null {
    let nearest: Grabbable | null = null;
    let nearestDist = GRAB_RANGE;

    for (const candidate of candidates) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, candidate.gameObject.x, candidate.gameObject.y);
      if (dist <= nearestDist) {
        nearest = candidate;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  private computeDebouncedGrounded(): boolean {
    const rawGrounded = this.body.blocked.down;
    this.ungroundedStreak = rawGrounded ? 0 : this.ungroundedStreak + 1;
    return rawGrounded || this.ungroundedStreak < UNGROUNDED_DEBOUNCE_FRAMES;
  }

  private updateTimers(deltaSeconds: number, grounded: boolean): void {
    this.coyoteTimerMs = grounded ? COYOTE_TIME_MS : Math.max(0, this.coyoteTimerMs - deltaSeconds * 1000);

    if (this.inputMap.isJumpJustPressed) {
      this.jumpBufferTimerMs = JUMP_BUFFER_MS;
    } else {
      this.jumpBufferTimerMs = Math.max(0, this.jumpBufferTimerMs - deltaSeconds * 1000);
    }
  }

  private updateHorizontal(deltaSeconds: number, grounded: boolean): void {
    const axis = this.inputMap.moveX();
    const weightMult = this.held?.speedMultiplier ?? 1;
    const targetSpeed = axis * MOVE_SPEED * weightMult;
    const control = grounded ? 1 : AIR_CONTROL_MULT;
    const rate = (Math.abs(targetSpeed) > Math.abs(this.body.velocity.x) ? ACCELERATION : DECELERATION) * control;

    this.body.velocity.x = moveTowards(this.body.velocity.x, targetSpeed, rate * deltaSeconds);
  }

  private updateJump(grounded: boolean): void {
    const canJump = this.coyoteTimerMs > 0;
    const wantsJump = this.jumpBufferTimerMs > 0;

    if (wantsJump && canJump) {
      this.body.velocity.y = JUMP_VELOCITY;
      this.coyoteTimerMs = 0;
      this.jumpBufferTimerMs = 0;
      this.jumpCutApplied = false;
      return;
    }

    if (this.inputMap.isJumpJustReleased && this.body.velocity.y < 0 && !this.jumpCutApplied) {
      this.body.velocity.y *= JUMP_CUT_MULTIPLIER;
      this.jumpCutApplied = true;
    }

    if (grounded) {
      this.jumpCutApplied = false;
    }
  }

  private updateFacing(): void {
    const axis = this.inputMap.moveX();
    if (axis > 0.05) {
      this.facing = 1;
    } else if (axis < -0.05) {
      this.facing = -1;
    }
    this.setScale(this.facing, 1);
  }

  private updateMovementState(grounded: boolean): void {
    const justLanded = grounded && !this.wasGrounded;

    if (justLanded) {
      this.playLandSquash();
      this.movementState = LexiState.LAND;
      return;
    }

    if (this.movementState === LexiState.LAND) {
      // Squash tween owns this window and resumes normal states via its
      // onComplete — unless Lexi leaves the ground again first (a jump
      // buffered right at landing), in which case that takes priority.
      if (!grounded) {
        this.movementState = this.body.velocity.y < 0 ? LexiState.JUMP : LexiState.FALL;
      }
      return;
    }

    if (!grounded) {
      this.movementState = this.body.velocity.y < 0 ? LexiState.JUMP : LexiState.FALL;
      return;
    }

    this.movementState = this.groundedLabel();
  }

  // GRAB only overrides the reported label while grounded and otherwise
  // idle/running — an airborne carry across a gap still reads as JUMP/FALL.
  private groundedLabel(): LexiState {
    if (this.held) {
      return LexiState.GRAB;
    }
    return Math.abs(this.body.velocity.x) > IDLE_SPEED_THRESHOLD ? LexiState.RUN : LexiState.IDLE;
  }

  private playLandSquash(): void {
    // A fast staircase (land, immediately jump again) can trigger a new
    // squash before the last one finishes — without this, both tweens fight
    // over scaleX/scaleY and the state label can get stuck on LAND.
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scaleY: { from: 0.75, to: 1 },
      scaleX: { from: this.facing * 1.15, to: this.facing },
      duration: LAND_SQUASH_MS,
      ease: "Sine.Out",
      onComplete: () => {
        if (this.movementState === LexiState.LAND) {
          this.movementState = this.groundedLabel();
        }
      },
    });
  }
}

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }
  return current + Math.sign(target - current) * maxDelta;
}
