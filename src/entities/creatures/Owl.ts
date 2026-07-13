import Phaser from "phaser";

export enum OwlState {
  PERCH = "PERCH",
  TELEGRAPH = "TELEGRAPH",
  SWOOP = "SWOOP",
  RETURN = "RETURN",
}

const TELEGRAPH_MS = 400; // brief wing-flare cue before the dive
const SWOOP_SPEED = 520; // px/s
const RETURN_SPEED = 260; // px/s
const REACHED_EPSILON = 4;

export const OWL_CATCH_RADIUS = 30; // px — how close during SWOOP counts as caught; the room decides the consequence
// Wider than the catch radius — close enough that a swooping owl reads as
// "coming for you" (Lexi's tail tucks, PROMPTS P4.3) before it's actually
// close enough to end the attempt.
export const OWL_SCARE_RADIUS = 90;

// Swoops at Lexi's position when the room tells it to (crossing open
// ground), then returns to perch. Deliberately no pathfinding: swoop and
// return are straight lines, matching this project's scripted-creature-
// brain scope (PROMPTS P2.3).
export class Owl {
  readonly gameObject: Phaser.GameObjects.Container;

  private state: OwlState = OwlState.PERCH;
  private readonly perchX: number;
  private readonly perchY: number;
  private telegraphTimerMs = 0;
  private swoopTargetX = 0;
  private swoopTargetY = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.perchX = x;
    this.perchY = y;

    this.gameObject = scene.add.container(x, y);
    const body = scene.add.ellipse(0, 0, 26, 18, 0x0a0a0a);
    const wingL = scene.add.triangle(-10, 0, 0, -10, 0, 10, -14, 0, 0x0a0a0a);
    const wingR = scene.add.triangle(10, 0, 0, -10, 0, 10, 14, 0, 0x0a0a0a);
    this.gameObject.add([wingL, wingR, body]);
  }

  get isSwooping(): boolean {
    return this.state === OwlState.SWOOP;
  }

  get isPerched(): boolean {
    return this.state === OwlState.PERCH;
  }

  get x(): number {
    return this.gameObject.x;
  }

  get y(): number {
    return this.gameObject.y;
  }

  triggerSwoop(targetX: number, targetY: number): void {
    if (this.state !== OwlState.PERCH) {
      return;
    }
    this.state = OwlState.TELEGRAPH;
    this.telegraphTimerMs = TELEGRAPH_MS;
    this.swoopTargetX = targetX;
    this.swoopTargetY = targetY;
  }

  update(deltaSeconds: number): void {
    switch (this.state) {
      case OwlState.TELEGRAPH:
        this.telegraphTimerMs -= deltaSeconds * 1000;
        if (this.telegraphTimerMs <= 0) {
          this.state = OwlState.SWOOP;
        }
        break;
      case OwlState.SWOOP:
        this.moveToward(this.swoopTargetX, this.swoopTargetY, SWOOP_SPEED, deltaSeconds);
        if (this.reached(this.swoopTargetX, this.swoopTargetY)) {
          this.state = OwlState.RETURN;
        }
        break;
      case OwlState.RETURN:
        this.moveToward(this.perchX, this.perchY, RETURN_SPEED, deltaSeconds);
        if (this.reached(this.perchX, this.perchY)) {
          this.state = OwlState.PERCH;
        }
        break;
      case OwlState.PERCH:
        break;
    }
  }

  private moveToward(targetX: number, targetY: number, speed: number, deltaSeconds: number): void {
    const dx = targetX - this.gameObject.x;
    const dy = targetY - this.gameObject.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) {
      return;
    }
    const step = Math.min(dist, speed * deltaSeconds);
    this.gameObject.x += (dx / dist) * step;
    this.gameObject.y += (dy / dist) * step;
  }

  private reached(targetX: number, targetY: number): boolean {
    return Phaser.Math.Distance.Between(this.gameObject.x, this.gameObject.y, targetX, targetY) < REACHED_EPSILON;
  }
}
