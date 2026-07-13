import Phaser from "phaser";
import { GrainPipeline } from "../fx/Grain";
import { FogLayers } from "../fx/Fog";
import { SaveSystem } from "../systems/SaveSystem";
import { createNoiseBuffer, playTone, playFilteredNoise } from "../fx/AudioSynth";

const ACCENT_COLOR = 0xaa3333; // SPEC §4's one accent hue — collar, leash, the ball

// Beat timestamps (ms) — the wordless 30s intro PROMPTS P4.2 asks for (SPEC
// §2's premise, told with zero words): car parked, ball bounces loose, Lexi
// chases it through the rest-stop gate, a passing truck's gust swings the
// gate shut behind her, the car (unaware) drives off, Lexi is alone.
const FADE_IN_MS = 1500;
const BALL_POP_MS = 1500;
const LEXI_JUMP_MS = 2200;
const CHASE_START_MS = 2000;
const CHASE_END_MS = 8000;
const BALL_SETTLE_MS = 8000;
const TRUCK_START_MS = 4500;
const TRUCK_END_MS = 7500;
const GATE_SWING_MS = 7500;
const GATE_SWING_DURATION_MS = 700;
const ENGINE_START_MS = 9600;
const CAR_DEPART_START_MS = 10300;
const CAR_DEPART_END_MS = 13500;
const LEXI_ALERT_MS = 13500;
const LEXI_RETURN_START_MS = 15000;
const LEXI_RETURN_END_MS = 18000;
const FADE_OUT_MS = 29000;
const TOTAL_MS = 30000;
const SKIP_FADE_MS = 300;

// Stage layout (fixed 1280x720 camera, no scroll — a single tableau, not a
// scrolling level). Road/car on the left, a rest-stop gate in the middle,
// grass/forest edge on the right — Lexi ends up on the far side of the gate
// from the car, which is the whole point of the beat.
const GROUND_Y = 620;
const CAR_START_X = 160;
const CAR_PARK_Y = GROUND_Y - 26;
const GATE_X = 560;
const BALL_START_X = 195;
const BALL_REST_X = 760;
const LEXI_START_X = CAR_START_X + 10;
const LEXI_CHASE_END_X = BALL_REST_X - 40;
const LEXI_RETURN_X = GATE_X - 60;

function lerp(a: number, b: number, t: number): number {
  return Phaser.Math.Linear(a, b, Phaser.Math.Clamp(t, 0, 1));
}

// progress of `elapsedMs` through [startMs, endMs], clamped to [0,1] — the
// basic building block every beat below is expressed in terms of.
function windowT(elapsedMs: number, startMs: number, endMs: number): number {
  if (endMs <= startMs) {
    return elapsedMs >= startMs ? 1 : 0;
  }
  return Phaser.Math.Clamp((elapsedMs - startMs) / (endMs - startMs), 0, 1);
}

// A few small bounce arcs between two x positions, each arc's peak height
// shrinking — reused for both the ball's escape bounce and its chase bounces.
function bounceY(baseY: number, t: number, bounces: number, peakHeight: number): number {
  const phase = t * bounces;
  const bounceIndex = Math.min(Math.floor(phase), bounces - 1);
  const localT = phase - bounceIndex;
  const heightFalloff = 1 - bounceIndex / bounces;
  return baseY - Math.sin(localT * Math.PI) * peakHeight * heightFalloff;
}

function buildCar(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const body = scene.add.rectangle(0, 0, 130, 40, 0x1c1c1c);
  const roof = scene.add.rectangle(-10, -32, 72, 28, 0x161616);
  const wheelA = scene.add.ellipse(-40, 20, 26, 26, 0x050505);
  const wheelB = scene.add.ellipse(40, 20, 26, 26, 0x050505);
  const door = scene.add.rectangle(30, -2, 3, 36, 0x090909);
  return scene.add.container(0, 0, [body, roof, wheelA, wheelB, door]);
}

function buildTruck(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const cab = scene.add.rectangle(-70, -10, 60, 50, 0x141414);
  const trailer = scene.add.rectangle(40, -18, 190, 66, 0x1a1a1a);
  const wheelA = scene.add.ellipse(-70, 22, 22, 22, 0x030303);
  const wheelB = scene.add.ellipse(10, 22, 22, 22, 0x030303);
  const wheelC = scene.add.ellipse(90, 22, 22, 22, 0x030303);
  return scene.add.container(0, 0, [trailer, cab, wheelA, wheelB, wheelC]);
}

function buildGate(scene: Phaser.Scene): Phaser.GameObjects.Rectangle {
  scene.add.rectangle(GATE_X, GROUND_Y - 55, 10, 110, 0x141414); // post
  const door = scene.add.rectangle(GATE_X, GROUND_Y - 55, 90, 8, 0x1a1a1a);
  door.setOrigin(0, 0.5); // pivot at the post — this is what "swings" via rotation
  return door;
}

function buildLexiPuppet(scene: Phaser.Scene): Phaser.GameObjects.Container {
  // Same silhouette composition as the real Lexi.ts capsule+eyes+collar, so
  // the intro's stand-in reads as "the same dog" once gameplay begins.
  const capsule = scene.add.ellipse(0, 0, 46, 26, 0x0a0a0a);
  const eyeFront = scene.add.ellipse(15, -6, 4, 4, 0xffffff);
  const collar = scene.add.rectangle(12, 2, 12, 5, ACCENT_COLOR);
  const leash = scene.add.rectangle(-8, 4, 46, 3, ACCENT_COLOR);
  leash.setOrigin(1, 0.5); // trails behind (negative-x side), per SPEC "leash trails behind her"
  return scene.add.container(0, 0, [leash, capsule, eyeFront, collar]);
}

function buildBackground(scene: Phaser.Scene): void {
  scene.add.rectangle(640, 360, 1280, 720, 0x0b0b0b).setDepth(-30);
  // Distant treeline, both sides — pure atmosphere, no interactivity.
  for (let i = 0; i < 10; i++) {
    const x = 40 + i * 130 + Phaser.Math.Between(-20, 20);
    const h = Phaser.Math.Between(90, 160);
    scene.add.triangle(x, GROUND_Y - h / 2, 0, h / 2, 40, -h / 2, 80, h / 2, 0x060606).setDepth(-20);
  }
  scene.add.rectangle(640, GROUND_Y + 60, 1280, 120, 0x141414).setDepth(-10); // road
  scene.add.rectangle(960, GROUND_Y + 70, 700, 140, 0x101410).setDepth(-10); // grass beyond the gate
}

// Wordless 30s premise intro (SPEC §2, PROMPTS P4.2): a scripted sequence,
// not a gameplay level — every object's transform is a pure function of
// `elapsedMs`, mirroring MemoryEchoVignette's manually-stepped phase clock
// rather than tweens, so the sequence is exactly reproducible frame-by-frame
// (see CLAUDE.md's tween-vs-manual-stepping gotcha).
export class IntroScene extends Phaser.Scene {
  private elapsedMs = 0;
  private finished = false;
  private skipRequestedAtMs: number | null = null;

  private car!: Phaser.GameObjects.Container;
  private truck!: Phaser.GameObjects.Container;
  private ball!: Phaser.GameObjects.Ellipse;
  private lexi!: Phaser.GameObjects.Container;
  private gateDoor!: Phaser.GameObjects.Rectangle;
  private fadeRect!: Phaser.GameObjects.Rectangle;
  private skipHint!: Phaser.GameObjects.Text;
  private fog?: FogLayers;

  private ctx!: AudioContext;
  private masterGain!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private firedCues = new Set<string>();

  constructor() {
    super("Intro");
  }

  create(): void {
    this.elapsedMs = 0;
    this.finished = false;
    this.skipRequestedAtMs = null;
    this.firedCues.clear();
    this.cameras.main.setBackgroundColor(0x0b0b0b);

    buildBackground(this);
    this.fog = new FogLayers(this, this.scale.width, this.scale.height);
    this.setupGrain();
    this.setupAudio();

    this.car = buildCar(this);
    this.car.setPosition(CAR_START_X, CAR_PARK_Y);

    this.truck = buildTruck(this);
    this.truck.setPosition(-250, GROUND_Y + 30);
    this.truck.setVisible(false);

    this.gateDoor = buildGate(this);

    this.ball = this.add.ellipse(BALL_START_X, GROUND_Y - 10, 18, 18, ACCENT_COLOR);
    this.ball.setVisible(false);

    this.lexi = buildLexiPuppet(this);
    this.lexi.setPosition(LEXI_START_X, GROUND_Y - 13);
    this.lexi.setVisible(false);

    this.fadeRect = this.add.rectangle(640, 360, 1280, 720, 0x000000, 1).setDepth(1000);
    this.skipHint = this.add
      .text(1268, 700, "press any key to skip", { fontFamily: "monospace", fontSize: "13px", color: "#666666" })
      .setOrigin(1, 1)
      .setDepth(1000)
      .setAlpha(0);

    this.input.keyboard?.on("keydown", () => this.skip());
    this.input.on("pointerdown", () => this.skip());
  }

  update(_time: number, delta: number): void {
    if (this.finished) {
      return;
    }
    this.elapsedMs += delta;
    this.fog?.update(delta / 1000);

    if (this.skipRequestedAtMs !== null) {
      this.fadeRect.setAlpha(1);
      if (this.elapsedMs - this.skipRequestedAtMs >= SKIP_FADE_MS) {
        this.complete();
      }
      return;
    }

    this.render(this.elapsedMs);

    if (this.elapsedMs >= TOTAL_MS) {
      this.complete();
    }
  }

  private render(t: number): void {
    // Fades.
    const fadeIn = 1 - windowT(t, 0, FADE_IN_MS);
    const fadeOut = windowT(t, FADE_OUT_MS, TOTAL_MS);
    this.fadeRect.setAlpha(Math.max(fadeIn, fadeOut));
    this.skipHint.setAlpha(t > FADE_IN_MS && t < FADE_OUT_MS ? 0.8 : 0);

    // Ball: pop out of the car, bounce toward the gate, bounce on into the
    // grass, then rest.
    if (t >= BALL_POP_MS) {
      this.ball.setVisible(true);
      const bounceT = windowT(t, BALL_POP_MS, BALL_SETTLE_MS);
      const x = lerp(BALL_START_X, BALL_REST_X, bounceT);
      const y = t >= BALL_SETTLE_MS ? GROUND_Y - 10 : bounceY(GROUND_Y - 10, bounceT, 6, 70);
      this.ball.setPosition(x, y);
      this.fireOnce("ballPop", t, BALL_POP_MS, () => this.playBallPop());
    }

    // Lexi: jump out of the car, chase the ball, catch up to it, then react
    // to the gate/car/being-alone beats in sequence.
    if (t >= LEXI_JUMP_MS) {
      this.lexi.setVisible(true);
      if (t < CHASE_END_MS) {
        const chaseT = windowT(t, CHASE_START_MS, CHASE_END_MS);
        const x = lerp(LEXI_START_X, LEXI_CHASE_END_X, chaseT);
        const bob = Math.abs(Math.sin(t * 0.012)) * 6;
        this.lexi.setPosition(x, GROUND_Y - 13 - bob);
        this.lexi.setScale(1, 1);
      } else if (t < LEXI_ALERT_MS) {
        // Sniffing the settled ball — a small idle bob, not moving.
        const bob = Math.sin(t * 0.005) * 2;
        this.lexi.setPosition(LEXI_CHASE_END_X, GROUND_Y - 13 - bob);
      } else if (t < LEXI_RETURN_START_MS) {
        // Alert beat: a quick startled scale-pulse in place (SPEC's "no
        // detailed head sprite yet" — greybox reads this as attention snapping up).
        const alertT = windowT(t, LEXI_ALERT_MS, LEXI_RETURN_START_MS);
        this.lexi.setScale(1, 1 + Math.sin(alertT * Math.PI) * 0.12);
      } else if (t < LEXI_RETURN_END_MS) {
        const returnT = windowT(t, LEXI_RETURN_START_MS, LEXI_RETURN_END_MS);
        const x = lerp(LEXI_CHASE_END_X, LEXI_RETURN_X, returnT);
        const bob = Math.abs(Math.sin(t * 0.01)) * 5;
        this.lexi.setPosition(x, GROUND_Y - 13 - bob);
        this.lexi.setScale(1, 1);
      } else {
        // Final tableau: alone, at the shut gate, a slow settle.
        const settleT = windowT(t, LEXI_RETURN_END_MS, LEXI_RETURN_END_MS + 1500);
        const bob = (1 - settleT) * Math.abs(Math.sin(t * 0.006)) * 4;
        this.lexi.setPosition(LEXI_RETURN_X, GROUND_Y - 13 - bob);
      }
    }

    // Truck: fast pass across the road, gust-swings the gate shut as it clears.
    if (t >= TRUCK_START_MS && t < TRUCK_END_MS + 500) {
      this.truck.setVisible(true);
      const truckT = windowT(t, TRUCK_START_MS, TRUCK_END_MS);
      this.truck.setPosition(lerp(-250, 1500, truckT), GROUND_Y + 30);
      this.fireOnce("truckPass", t, TRUCK_START_MS, () => this.playTruckPass());
    } else if (t >= TRUCK_END_MS + 500) {
      this.truck.setVisible(false);
    }

    // Gate: closed by the truck's gust just after it clears.
    if (t >= GATE_SWING_MS) {
      const swingT = windowT(t, GATE_SWING_MS, GATE_SWING_MS + GATE_SWING_DURATION_MS);
      this.gateDoor.setRotation(lerp(0, -1.4, swingT)); // swings from open (flat) to shut (across the gap)
      this.fireOnce("gateSwing", t, GATE_SWING_MS, () => this.playGateSwing());
    }

    // Car: idles, then starts and drives off-screen, unaware.
    this.fireOnce("engineStart", t, ENGINE_START_MS, () => this.playEngineStart());
    if (t >= CAR_DEPART_START_MS) {
      const departT = windowT(t, CAR_DEPART_START_MS, CAR_DEPART_END_MS);
      this.car.setPosition(lerp(CAR_START_X, -300, departT), CAR_PARK_Y);
      if (departT >= 1 && !this.firedCues.has("carGone")) {
        this.firedCues.add("carGone");
        this.car.setVisible(false);
      }
    }
  }

  private fireOnce(key: string, t: number, triggerMs: number, effect: () => void): void {
    if (t >= triggerMs && !this.firedCues.has(key)) {
      this.firedCues.add(key);
      effect();
    }
  }

  private skip(): void {
    // Any input skips immediately — never trap the player in a cutscene,
    // regardless of whether this is their first viewing or their tenth.
    // Uses the same manually-stepped `elapsedMs` clock as the rest of this
    // scene (not `time.delayedCall`) so it stays exactly reproducible under
    // `game.loop.step()` during verification.
    if (this.finished || this.skipRequestedAtMs !== null) {
      return;
    }
    this.skipRequestedAtMs = this.elapsedMs;
  }

  private complete(): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    new SaveSystem().markIntroSeen();
    this.scene.start("Game", { map: "ch1_01_reststop" });
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
  }

  // A small, self-contained set of cutscene-only cues (ball pop, truck pass,
  // gate creak, engine start) — deliberately not routed through AudioSystem,
  // which is scoped to reusable gameplay sound (beds, footsteps, bark,
  // whistle) rather than one-off narrative beats. Same synthesis primitives
  // (fx/AudioSynth.ts) and the same resume-on-first-gesture pattern as
  // AudioSystem's constructor (P3.3) — the intro is often the player's very
  // first interaction with the page, so the autoplay-suspended state is
  // guaranteed here, not just possible.
  private setupAudio(): void {
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextCtor();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);
    this.noiseBuffer = createNoiseBuffer(this.ctx, 3);

    const resume = () => {
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    };
    this.input.keyboard?.on("keydown", resume);
    this.input.on("pointerdown", resume);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.ctx.state !== "closed") {
        this.ctx.close();
      }
    });
  }

  private playBallPop(): void {
    playTone(this.ctx, this.masterGain, { freq: 300, freqEnd: 150, duration: 0.12, type: "triangle", peakGain: 0.2, attack: 0.005 });
  }

  private playTruckPass(): void {
    playFilteredNoise(this.ctx, this.masterGain, this.noiseBuffer, {
      duration: (TRUCK_END_MS - TRUCK_START_MS) / 1000,
      filterType: "lowpass",
      filterFreq: 500,
      filterQ: 0.8,
      peakGain: 0.22,
      attack: 0.3,
    });
    playTone(this.ctx, this.masterGain, {
      freq: 90,
      duration: (TRUCK_END_MS - TRUCK_START_MS) / 1000,
      type: "sawtooth",
      peakGain: 0.12,
      attack: 0.2,
    });
  }

  private playGateSwing(): void {
    playTone(this.ctx, this.masterGain, { freq: 160, freqEnd: 90, duration: 0.4, type: "sine", peakGain: 0.22, attack: 0.03 });
    playFilteredNoise(this.ctx, this.masterGain, this.noiseBuffer, {
      duration: 0.08,
      filterType: "highpass",
      filterFreq: 1800,
      peakGain: 0.18,
      attack: 0.002,
      startDelay: GATE_SWING_DURATION_MS / 1000,
    });
  }

  private playEngineStart(): void {
    playTone(this.ctx, this.masterGain, { freq: 70, freqEnd: 95, duration: 0.5, type: "sawtooth", peakGain: 0.16, attack: 0.05 });
    playTone(this.ctx, this.masterGain, {
      freq: 85,
      duration: (CAR_DEPART_END_MS - CAR_DEPART_START_MS) / 1000,
      type: "sawtooth",
      peakGain: 0.1,
      attack: 0.4,
      startDelay: 0.5,
    });
  }
}
