import Phaser from "phaser";

export enum GuardDogState {
  IDLE = "IDLE",
  COIL = "COIL",
  LUNGE = "LUNGE",
  RECOVER = "RECOVER",
}

const LUNGE_TRIGGER_RADIUS = 180;
const COIL_MS = 220; // brief telegraph before the strike actually moves — the reaction window baiting depends on
const LUNGE_SPEED = 480; // px/s while lunging
const RECOVER_SPEED = 140; // px/s while retracting — the exploitable window
const REACHED_EPSILON = 4;

export const GUARD_DOG_BITE_RADIUS = 34; // px — how close during LUNGE counts as caught; the room decides the consequence

// Anchored on an invisible chain: coils briefly, then lunges at wherever
// Lexi was standing the instant it triggered, clamped to chainLength from
// its anchor, then retracts slowly before it can lunge again. The target is
// committed once, not re-aimed at her current position every frame — a
// lunge that kept homing in on a live target would be unbeatable against a
// slower player, which defeats "solvable only by baiting the lunge"
// (PROMPTS P2.3): the puzzle only exists because the strike commits to a
// fixed point and gives a beat of warning first, so moving away the instant
// it triggers is what creates the exploitable gap — an homage to Limbo's
// spider-leg pacing (SPEC §3), a leg that swipes at where you were and
// telegraphs the swipe, not one that tracks you psychically.
export class GuardDog {
  readonly gameObject: Phaser.GameObjects.Container;

  private state: GuardDogState = GuardDogState.IDLE;
  private readonly anchorX: number;
  private readonly anchorY: number;
  private readonly chainLength: number;
  private lungeTargetX = 0;
  private lungeTargetY = 0;
  private coilTimerMs = 0;

  constructor(scene: Phaser.Scene, anchorX: number, anchorY: number, chainLength: number) {
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    this.chainLength = chainLength;

    this.gameObject = scene.add.container(anchorX, anchorY);
    const body = scene.add.ellipse(0, 0, 34, 22, 0x0a0a0a);
    const head = scene.add.ellipse(16, -4, 14, 12, 0x0a0a0a);
    this.gameObject.add([body, head]);
  }

  get isLunging(): boolean {
    return this.state === GuardDogState.LUNGE;
  }

  get isCoiling(): boolean {
    return this.state === GuardDogState.COIL;
  }

  get x(): number {
    return this.gameObject.x;
  }

  get y(): number {
    return this.gameObject.y;
  }

  update(deltaSeconds: number, lexiX: number, lexiY: number): void {
    switch (this.state) {
      case GuardDogState.IDLE: {
        const dist = Phaser.Math.Distance.Between(this.anchorX, this.anchorY, lexiX, lexiY);
        if (dist <= LUNGE_TRIGGER_RADIUS) {
          this.state = GuardDogState.COIL;
          this.coilTimerMs = COIL_MS;
          this.lungeTargetX = lexiX;
          this.lungeTargetY = lexiY;
        }
        break;
      }
      case GuardDogState.COIL: {
        this.coilTimerMs -= deltaSeconds * 1000;
        if (this.coilTimerMs <= 0) {
          this.state = GuardDogState.LUNGE;
        }
        break;
      }
      case GuardDogState.LUNGE: {
        this.moveClamped(this.lungeTargetX, this.lungeTargetY, LUNGE_SPEED, deltaSeconds);
        const distFromAnchor = Phaser.Math.Distance.Between(this.anchorX, this.anchorY, this.gameObject.x, this.gameObject.y);
        const reachedTarget = Phaser.Math.Distance.Between(this.gameObject.x, this.gameObject.y, this.lungeTargetX, this.lungeTargetY) < REACHED_EPSILON;
        if (distFromAnchor >= this.chainLength - 1 || reachedTarget) {
          this.state = GuardDogState.RECOVER;
        }
        break;
      }
      case GuardDogState.RECOVER: {
        this.moveClamped(this.anchorX, this.anchorY, RECOVER_SPEED, deltaSeconds);
        if (Phaser.Math.Distance.Between(this.gameObject.x, this.gameObject.y, this.anchorX, this.anchorY) < REACHED_EPSILON) {
          this.state = GuardDogState.IDLE;
        }
        break;
      }
    }
  }

  private moveClamped(targetX: number, targetY: number, speed: number, deltaSeconds: number): void {
    const dx = targetX - this.gameObject.x;
    const dy = targetY - this.gameObject.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      const step = Math.min(dist, speed * deltaSeconds);
      this.gameObject.x += (dx / dist) * step;
      this.gameObject.y += (dy / dist) * step;
    }

    const fromAnchorX = this.gameObject.x - this.anchorX;
    const fromAnchorY = this.gameObject.y - this.anchorY;
    const fromAnchorDist = Math.hypot(fromAnchorX, fromAnchorY);
    if (fromAnchorDist > this.chainLength) {
      const scale = this.chainLength / fromAnchorDist;
      this.gameObject.x = this.anchorX + fromAnchorX * scale;
      this.gameObject.y = this.anchorY + fromAnchorY * scale;
    }
  }
}
