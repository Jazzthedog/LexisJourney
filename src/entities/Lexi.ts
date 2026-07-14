import Phaser from "phaser";
import { InputMap } from "../systems/InputMap";
import type { Grabbable } from "./props/Grabbable";
import type { SoundReactive } from "./SoundReactive";
import type { DigSpot } from "./props/DigSpot";
import type { WaterZone } from "./props/WaterZone";
import type { WindZone } from "./props/WindZone";

// SPEC §4: "tail as an emotion channel — tail animation = the entire
// facial-expression budget." Priority order (highest first): happy (a
// pickup-triggered wag burst) beats scared (real danger) beats curious
// (actively sniffing) beats the neutral resting pose.
export type LexiEmotion = "neutral" | "curious" | "scared" | "happy";

export enum LexiState {
  IDLE = "IDLE",
  RUN = "RUN",
  JUMP = "JUMP",
  FALL = "FALL",
  LAND = "LAND",
  GRAB = "GRAB",
  BARK = "BARK",
  SNIFF = "SNIFF",
  DIG = "DIG",
  SWIM = "SWIM",
}

export interface LexiInteractables {
  grabCandidates?: Grabbable[];
  soundReactive?: SoundReactive[];
  digSpots?: DigSpot[];
  waterZones?: WaterZone[];
  windZones?: WindZone[];
}

export interface LexiSnapshot {
  x: number;
  y: number;
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

const BARK_RADIUS = 220; // px — how far a bark notifies SoundReactive objects
const BARK_STATE_MS = 300; // how long BARK overrides the reported label
const BARK_ANIM_MS = 140;
const SNIFF_SPEED_MULT = 0.5;
const DIG_RANGE = 50; // px — how close a DigSpot needs to be to dig it
const DIG_STATE_MS = 500;

const WATER_SWIM_SPEED_MULT = 0.5;
const WATER_MAX_SINK_SPEED = 60; // px/s cap on downward speed while swimming — buoyant, not falling

const BODY_WIDTH = 26;
const BODY_HEIGHT = 46;

// Visual-only dog silhouette geometry — deliberately decoupled from
// BODY_WIDTH/BODY_HEIGHT above. Those stay fixed because every Chapter 1
// map's jump gaps and ledge clearances were tuned against that exact hitbox
// (see CLAUDE.md's "Arcade can't cut the corner" gotcha) — changing them
// would silently re-break geometry that's already been verified. The drawn
// shapes below don't feed into physics at all (Phaser collision only reads
// body.width/height/offset), so they're free to be a completely different,
// actually-dog-proportioned silhouette: low and wide instead of the old
// capsule, which literally reused the tall/narrow hitbox dimensions as its
// visual size and read as an egg standing on end, not an animal.
const VISUAL_BODY_WIDTH = 46;
const VISUAL_BODY_HEIGHT = 20;
const VISUAL_BODY_Y = -2;
const HEAD_X = 20;
const HEAD_Y = -14;
const HEAD_SIZE = 17;
const LEG_TOP_Y = 6;
const LEG_BOTTOM_Y = 21;
const LEG_FRONT_X = 13;
const LEG_BACK_X = -13;
const LEG_WIDTH = 6;

// Tail rig (SPEC §4's emotion channel). Angles in radians, Phaser's y-down
// convention: negative = tip swings up, positive = tip swings down.
const TAIL_ANGLE_NEUTRAL = -0.15;
const TAIL_ANGLE_CURIOUS = -0.55;
const TAIL_ANGLE_SCARED = 0.45;
const TAIL_WAG_AMPLITUDE = 0.35;
const TAIL_WAG_HZ_RUN = 3.2; // wag frequency while running (a loose trot rhythm)
const TAIL_WAG_HZ_HAPPY = 7; // fast excited wag on a token pickup
// A spring-like follow-through, not a snap: the tail chases its target angle
// at a capped rate per second rather than jumping straight to it, so a
// sudden emotion change (e.g. an owl swoop) reads as a flinch, not a cut.
const TAIL_FOLLOW_RATE = 9; // rad/s max chase speed
const EAR_ANGLE_ALERT = 0.12; // perked, facing slightly forward
const EAR_ANGLE_SCARED = 0.65; // flattened back
const EAR_FOLLOW_RATE = 10;
// Legs are pivoted containers, same trick as the tail — rotating the
// container swings the whole leg like a real limb from the hip/shoulder.
// Two legs, not four: a standard silhouette-game shorthand (the far pair is
// implied, not drawn) that keeps the run-cycle math simple and still reads
// as "walking on legs" at this scale.
const LEG_ANGLE_IDLE = 0.08;
const LEG_SWING_AMPLITUDE = 0.6;
const LEG_WAG_HZ_RUN = 4.6; // matches RUN_BOB_HZ so legs and the body bob read as one gait
const LEG_FOLLOW_RATE = 16;
const CELEBRATE_MS = 1300; // ClueSystem calls celebrate() on a Memory Token pickup
const SCARED_SUBMERSION_MS = 1500; // "getting worried" threshold while swimming
const RUN_BOB_HZ = 4.6;
const RUN_BOB_AMPLITUDE = 2.2; // px

export class Lexi extends Phaser.GameObjects.Container {
  declare body: Phaser.Physics.Arcade.Body;

  private inputMap: InputMap;
  private movementState: LexiState = LexiState.IDLE;
  private facing: 1 | -1 = 1;

  // Visuals live in their own child container so squash/bounce tweens on it
  // never fight updateFacing()'s per-frame scaleX flip on the outer (physics)
  // container — they used to target the same object and silently cancel out.
  private visualRoot: Phaser.GameObjects.Container;

  private coyoteTimerMs = 0;
  private jumpBufferTimerMs = 0;
  private jumpCutApplied = false;
  private wasGrounded = false;
  private ungroundedStreak = 0;
  private debouncedGrounded = false;

  private held: Grabbable | null = null;
  private barkTimerMs = 0;
  private digTimerMs = 0;
  private submersionMs = 0;
  private activeCurrentVx = 0;
  private activeGustVx = 0;

  // Silhouette rig (PROMPTS P4.3): tail/ears are separate child GameObjects
  // whose *rotation* is driven manually every frame, deliberately not via
  // Phaser tweens — visualRoot's own scaleX/scaleY is already tween-owned by
  // playLandSquash/playBarkAnimation, and rotation is an orthogonal property
  // on different objects, so there's no risk of repeating the "two systems
  // fighting over the same transform" bug the visualRoot split originally
  // fixed. A per-frame value also tracks game.loop.step() exactly, unlike a
  // tween (see CLAUDE.md's tween-vs-manual-stepping gotcha).
  private tail!: Phaser.GameObjects.Container;
  private earFront!: Phaser.GameObjects.Triangle;
  private earBack!: Phaser.GameObjects.Triangle;
  private legFront!: Phaser.GameObjects.Container;
  private legBack!: Phaser.GameObjects.Container;
  private tailAngle = TAIL_ANGLE_NEUTRAL;
  private earAngle = EAR_ANGLE_ALERT;
  private legFrontAngle = LEG_ANGLE_IDLE;
  private legBackAngle = -LEG_ANGLE_IDLE;
  private runCycleMs = 0;
  private celebrateTimerMs = 0;
  private threatened = false;

  constructor(scene: Phaser.Scene, x: number, y: number, inputMap: InputMap) {
    super(scene, x, y);
    this.inputMap = inputMap;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(BODY_WIDTH, BODY_HEIGHT);
    this.body.setOffset(-BODY_WIDTH / 2, -BODY_HEIGHT / 2);
    this.body.setMaxVelocity(MOVE_SPEED * 1.6, 1000);
    this.body.setCollideWorldBounds(true);

    // Lexi's silhouette needs to read as an actual dog — low, wide body,
    // a distinct head with a snout, legs reaching the ground — not just a
    // colored blob with accent details floating on it. 0x0a0a0a is a solid
    // mid-grey against every map's near-black background.
    const body = scene.add.ellipse(0, VISUAL_BODY_Y, VISUAL_BODY_WIDTH, VISUAL_BODY_HEIGHT, 0x0a0a0a);
    const head = scene.add.ellipse(HEAD_X, HEAD_Y, HEAD_SIZE, HEAD_SIZE - 3, 0x0a0a0a);
    const snout = scene.add.triangle(HEAD_X + 8, HEAD_Y + 2, -2, -4, 9, 0, -2, 5, 0x0a0a0a);
    const eye = scene.add.ellipse(HEAD_X + 5, HEAD_Y - 3, 4, 4, 0xffffff);
    const collar = scene.add.rectangle(HEAD_X - 7, HEAD_Y + 9, 10, 5, 0xaa3333);

    // Pointed ears (SPEC §4's "readable animal silhouette"), sitting on top
    // of the head now rather than on the old capsule's shoulder.
    this.earFront = scene.add.triangle(HEAD_X + 3, HEAD_Y - 11, -4, 6, 0, -9, 4, 6, 0x0a0a0a);
    this.earBack = scene.add.triangle(HEAD_X - 4, HEAD_Y - 11, -4, 6, 0, -9, 4, 6, 0x060606);

    // Tail: a Container pivoted at the hindquarters so rotating it swings
    // the whole tail like a real pivot, not a shape spinning around its own
    // centroid. Extends toward -x (behind Lexi when facing right; the outer
    // container's facing-flip scale handles mirroring for free).
    const tailShape = scene.add.triangle(0, 0, 0, -3, -22, 0, 0, 3, 0x0a0a0a);
    this.tail = scene.add.container(-18, -3, [tailShape]);
    this.tail.rotation = this.tailAngle;

    // Legs: same pivoted-container trick as the tail, rooted at the hip so
    // rotation swings the leg from the top like a real limb rather than
    // sliding the whole rectangle sideways.
    const legFrontShape = scene.add.rectangle(0, (LEG_BOTTOM_Y - LEG_TOP_Y) / 2, LEG_WIDTH, LEG_BOTTOM_Y - LEG_TOP_Y, 0x060606);
    this.legFront = scene.add.container(LEG_FRONT_X, LEG_TOP_Y, [legFrontShape]);
    this.legFront.rotation = this.legFrontAngle;
    const legBackShape = scene.add.rectangle(0, (LEG_BOTTOM_Y - LEG_TOP_Y) / 2, LEG_WIDTH, LEG_BOTTOM_Y - LEG_TOP_Y, 0x060606);
    this.legBack = scene.add.container(LEG_BACK_X, LEG_TOP_Y, [legBackShape]);
    this.legBack.rotation = this.legBackAngle;

    this.visualRoot = scene.add.container(0, 0, [
      this.tail,
      this.legBack,
      this.legFront,
      body,
      this.earBack,
      this.earFront,
      head,
      snout,
      eye,
      collar,
    ]);
    this.add(this.visualRoot);
  }

  get facingDirection(): 1 | -1 {
    return this.facing;
  }

  get isSniffing(): boolean {
    return this.inputMap.isSniffDown;
  }

  get waterSubmersionMs(): number {
    return this.submersionMs;
  }

  get isRunning(): boolean {
    return this.movementState === LexiState.RUN;
  }

  get isGrounded(): boolean {
    return this.debouncedGrounded;
  }

  get emotion(): LexiEmotion {
    return this.computeEmotion();
  }

  // A brief fast tail-wag burst — SPEC's "wag on token pickup." Called by
  // ClueSystem, not derived internally, since "a Memory Token was just
  // collected" isn't state Lexi has any other reason to know about.
  celebrate(): void {
    this.celebrateTimerMs = CELEBRATE_MS;
  }

  // Set by whatever detects the danger (LevelLoader's owl-swoop-proximity
  // check, currently) — Lexi doesn't know about owls any more than she
  // knows about ClueSystem's tokens; she just reports the emotion.
  setThreatened(threatened: boolean): void {
    this.threatened = threatened;
  }

  getDebugState(): string {
    const vx = Math.round(this.body.velocity.x);
    const vy = Math.round(this.body.velocity.y);
    const holding = this.held ? ` holding=${this.held.kind}` : "";
    const submerged = this.submersionMs > 0 ? ` submersionMs=${Math.round(this.submersionMs)}` : "";
    return `${this.movementState} facing=${this.facing > 0 ? "R" : "L"} vx=${vx} vy=${vy} grounded=${this.debouncedGrounded}${holding}${submerged} emotion=${this.computeEmotion()}`;
  }

  update(deltaSeconds: number, interactables: LexiInteractables = {}): void {
    const grounded = this.computeDebouncedGrounded();
    this.debouncedGrounded = grounded;

    const swimming = this.updateWater(deltaSeconds, grounded, interactables.waterZones ?? []);
    this.updateWind(interactables.windZones ?? []);
    this.updateGrab(deltaSeconds, interactables.grabCandidates ?? []);
    this.updateBark(deltaSeconds, interactables.soundReactive ?? []);
    this.updateDig(deltaSeconds, grounded, interactables.digSpots ?? []);
    this.updateTimers(deltaSeconds, grounded);
    this.updateHorizontal(deltaSeconds, grounded, swimming);
    this.updateJump(grounded);
    this.updateFacing();
    this.updateMovementState(grounded, swimming);
    this.updateVisualRig(deltaSeconds, grounded);

    this.wasGrounded = grounded;
  }

  captureSnapshot(): LexiSnapshot {
    return { x: this.x, y: this.y };
  }

  restoreSnapshot(snapshot: LexiSnapshot): void {
    this.body.reset(snapshot.x, snapshot.y);
    this.body.velocity.set(0, 0);
    this.coyoteTimerMs = 0;
    this.jumpBufferTimerMs = 0;
    this.jumpCutApplied = false;
    this.wasGrounded = false;
    this.ungroundedStreak = 0;
    this.debouncedGrounded = false;
    this.submersionMs = 0;
    this.held?.onRelease(this);
    this.held = null;
    this.movementState = LexiState.IDLE;
    this.scene.tweens.killTweensOf(this.visualRoot);
    this.visualRoot.setScale(1, 1);
    this.visualRoot.y = 0;
    this.threatened = false;
    this.celebrateTimerMs = 0;
    this.runCycleMs = 0;
    this.tailAngle = TAIL_ANGLE_NEUTRAL;
    this.tail.rotation = this.tailAngle;
    this.earAngle = EAR_ANGLE_ALERT;
    this.earFront.rotation = this.earAngle;
    this.earBack.rotation = this.earAngle;
    this.legFrontAngle = LEG_ANGLE_IDLE;
    this.legBackAngle = -LEG_ANGLE_IDLE;
    this.legFront.rotation = this.legFrontAngle;
    this.legBack.rotation = this.legBackAngle;
  }

  private updateGrab(deltaSeconds: number, grabCandidates: Grabbable[]): void {
    if (!this.held && this.inputMap.isGrabJustPressed) {
      this.held = this.findNearest(grabCandidates, GRAB_RANGE, (c) => c.gameObject);
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

  private updateBark(deltaSeconds: number, soundReactive: SoundReactive[]): void {
    this.barkTimerMs = Math.max(0, this.barkTimerMs - deltaSeconds * 1000);

    if (!this.inputMap.isBarkJustPressed) {
      return;
    }

    this.barkTimerMs = BARK_STATE_MS;
    this.playBarkAnimation();
    this.emit("bark"); // AudioSystem (P3.3) or anything else listens externally; Lexi doesn't know about audio

    for (const target of soundReactive) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, target.gameObject.x, target.gameObject.y);
      if (dist <= BARK_RADIUS) {
        target.onBark(this.x, this.y);
      }
    }
  }

  private updateDig(deltaSeconds: number, grounded: boolean, digSpots: DigSpot[]): void {
    this.digTimerMs = Math.max(0, this.digTimerMs - deltaSeconds * 1000);

    if (!grounded || !this.inputMap.isDigJustPressed) {
      return;
    }

    const diggable = digSpots.filter((spot) => !spot.isDug);
    const spot = this.findNearest(diggable, DIG_RANGE, (s) => s.gameObject);
    if (spot) {
      spot.onDig(this);
      this.digTimerMs = DIG_STATE_MS;
    }
  }

  private updateWater(deltaSeconds: number, grounded: boolean, waterZones: WaterZone[]): boolean {
    const zone = waterZones.find((z) => z.contains(this.x, this.y));
    const swimming = !!zone && !grounded;

    if (swimming) {
      this.submersionMs += deltaSeconds * 1000;
      this.activeCurrentVx = zone!.currentVx;
      if (this.body.velocity.y > WATER_MAX_SINK_SPEED) {
        this.body.velocity.y = WATER_MAX_SINK_SPEED;
      }
    } else {
      this.submersionMs = 0;
      this.activeCurrentVx = 0;
    }

    return swimming;
  }

  private updateWind(windZones: WindZone[]): void {
    const zone = windZones.find((z) => z.contains(this.x, this.y));
    this.activeGustVx = zone?.currentForceX ?? 0;
  }

  private findNearest<T>(
    candidates: T[],
    range: number,
    getPosition: (candidate: T) => { x: number; y: number },
  ): T | null {
    let nearest: T | null = null;
    let nearestDist = range;

    for (const candidate of candidates) {
      const pos = getPosition(candidate);
      const dist = Phaser.Math.Distance.Between(this.x, this.y, pos.x, pos.y);
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

  private updateHorizontal(deltaSeconds: number, grounded: boolean, swimming: boolean): void {
    const axis = this.inputMap.moveX();
    const weightMult = this.held?.speedMultiplier ?? 1;
    const sniffMult = this.isSniffing ? SNIFF_SPEED_MULT : 1;
    const swimMult = swimming ? WATER_SWIM_SPEED_MULT : 1;
    // Current and gust are folded into the target rather than added
    // post-hoc: this method already overwrites velocity.x wholesale via
    // moveTowards, so a same-frame-earlier "+=" from a separate step would
    // just get clobbered here (and a post-hoc "+=" after this method would
    // get erased right back on the very next frame, since moveTowards snaps
    // fully to target whenever the gap is smaller than one frame's max
    // step). Folding both into the target itself is the only place either
    // has a lasting effect.
    const currentOffset = swimming ? this.activeCurrentVx : 0;
    const targetSpeed = axis * MOVE_SPEED * weightMult * sniffMult * swimMult + currentOffset + this.activeGustVx;
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

  private updateMovementState(grounded: boolean, swimming: boolean): void {
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
        this.movementState = this.airborneLabel(swimming);
      }
      return;
    }

    if (!grounded) {
      this.movementState = this.airborneLabel(swimming);
      return;
    }

    this.movementState = this.groundedLabel();
  }

  private airborneLabel(swimming: boolean): LexiState {
    if (swimming) {
      return LexiState.SWIM;
    }
    return this.body.velocity.y < 0 ? LexiState.JUMP : LexiState.FALL;
  }

  // Priority among the "grounded, otherwise idle/running" modifier states:
  // a deliberate momentary action (DIG, then BARK) beats an ongoing hold
  // (GRAB), which beats a passive read-the-environment mode (SNIFF). An
  // airborne carry or jump-barking across a gap still reads as JUMP/FALL —
  // none of this overrides the airborne branch above.
  private groundedLabel(): LexiState {
    if (this.digTimerMs > 0) {
      return LexiState.DIG;
    }
    if (this.barkTimerMs > 0) {
      return LexiState.BARK;
    }
    if (this.held) {
      return LexiState.GRAB;
    }
    if (this.isSniffing) {
      return LexiState.SNIFF;
    }
    return Math.abs(this.body.velocity.x) > IDLE_SPEED_THRESHOLD ? LexiState.RUN : LexiState.IDLE;
  }

  private computeEmotion(): LexiEmotion {
    if (this.celebrateTimerMs > 0) {
      return "happy";
    }
    if (this.threatened || this.submersionMs > SCARED_SUBMERSION_MS) {
      return "scared";
    }
    if (this.isSniffing) {
      return "curious";
    }
    return "neutral";
  }

  // Tail/ear rotation, run-cycle bob — all pure per-frame computation, no
  // tweens (see the constructor comment on why). `runCycleMs` free-runs
  // whenever grounded+running so the wag/bob phase stays continuous rather
  // than resetting every stride, which would look like a twitch.
  private updateVisualRig(deltaSeconds: number, grounded: boolean): void {
    this.celebrateTimerMs = Math.max(0, this.celebrateTimerMs - deltaSeconds * 1000);

    const running = grounded && this.movementState === LexiState.RUN;
    if (running || this.celebrateTimerMs > 0) {
      this.runCycleMs += deltaSeconds * 1000;
    }

    const emotion = this.computeEmotion();
    const targetTailBase = emotion === "scared" ? TAIL_ANGLE_SCARED : emotion === "curious" ? TAIL_ANGLE_CURIOUS : TAIL_ANGLE_NEUTRAL;

    let targetTail = targetTailBase;
    if (emotion === "happy") {
      targetTail = Math.sin((this.runCycleMs / 1000) * TAIL_WAG_HZ_HAPPY * Math.PI * 2) * TAIL_WAG_AMPLITUDE;
    } else if (running) {
      targetTail = targetTailBase + Math.sin((this.runCycleMs / 1000) * TAIL_WAG_HZ_RUN * Math.PI * 2) * TAIL_WAG_AMPLITUDE * 0.5;
    }

    this.tailAngle = moveTowards(this.tailAngle, targetTail, TAIL_FOLLOW_RATE * deltaSeconds);
    this.tail.rotation = this.tailAngle;

    const targetEar = emotion === "scared" ? EAR_ANGLE_SCARED : EAR_ANGLE_ALERT;
    this.earAngle = moveTowards(this.earAngle, targetEar, EAR_FOLLOW_RATE * deltaSeconds);
    this.earFront.rotation = this.earAngle;
    this.earBack.rotation = this.earAngle;

    // Legs alternate (front and back out of phase) while running, matching
    // RUN_BOB_HZ so the stride and the body bob read as one gait; otherwise
    // they ease back to a static standing angle.
    const targetLegFront = running
      ? Math.sin((this.runCycleMs / 1000) * LEG_WAG_HZ_RUN * Math.PI * 2) * LEG_SWING_AMPLITUDE
      : LEG_ANGLE_IDLE;
    const targetLegBack = running
      ? -Math.sin((this.runCycleMs / 1000) * LEG_WAG_HZ_RUN * Math.PI * 2) * LEG_SWING_AMPLITUDE
      : -LEG_ANGLE_IDLE;
    this.legFrontAngle = moveTowards(this.legFrontAngle, targetLegFront, LEG_FOLLOW_RATE * deltaSeconds);
    this.legBackAngle = moveTowards(this.legBackAngle, targetLegBack, LEG_FOLLOW_RATE * deltaSeconds);
    this.legFront.rotation = this.legFrontAngle;
    this.legBack.rotation = this.legBackAngle;

    // A subtle bob while actually running — gated off during LAND (whose
    // squash tween owns visualRoot's scale, not position, so no conflict,
    // but bobbing mid-squash would look like two animations arguing) and
    // while airborne (JUMP/FALL/SWIM read better with a level silhouette).
    if (running && this.movementState !== LexiState.LAND) {
      this.visualRoot.y = -Math.abs(Math.sin((this.runCycleMs / 1000) * RUN_BOB_HZ * Math.PI * 2)) * RUN_BOB_AMPLITUDE;
    } else if (this.movementState !== LexiState.LAND) {
      this.visualRoot.y = 0;
    }
  }

  private playLandSquash(): void {
    // A fast staircase (land, immediately jump again) can trigger a new
    // squash before the last one finishes — without this, both tweens fight
    // over scale and the state label can get stuck on LAND.
    this.scene.tweens.killTweensOf(this.visualRoot);
    this.scene.tweens.add({
      targets: this.visualRoot,
      scaleY: { from: 0.75, to: 1 },
      scaleX: { from: 1.15, to: 1 },
      duration: LAND_SQUASH_MS,
      ease: "Sine.Out",
      onComplete: () => {
        if (this.movementState === LexiState.LAND) {
          this.movementState = this.groundedLabel();
        }
      },
    });
  }

  private playBarkAnimation(): void {
    this.scene.tweens.killTweensOf(this.visualRoot);
    this.scene.tweens.add({
      targets: this.visualRoot,
      scaleY: { from: 1, to: 1.2 },
      scaleX: { from: 1, to: 0.9 },
      duration: BARK_ANIM_MS,
      yoyo: true,
      ease: "Sine.Out",
    });
  }
}

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }
  return current + Math.sign(target - current) * maxDelta;
}
