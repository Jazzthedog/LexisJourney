import Phaser from "phaser";
import { GrainPipeline } from "../fx/Grain";
import { DEBUG } from "../debug/flag";
import { DebugHarness } from "../debug/DebugHarness";
import { TEST_ROOMS, DEFAULT_ROOM_KEY, TestRoomHandle } from "../debug/TestRooms";
import { preloadLevel, buildLevel } from "../levels/LevelLoader";
import { TouchControls } from "../systems/TouchControls";
import { SettingsSystem } from "../systems/SettingsSystem";

interface GameSceneData {
  room?: string;
  map?: string;
}

// PROMPTS P5.1: "it holds a stable framerate on a mid-range phone (grain/fog
// auto-degrade if not)." A sustained (not momentary — a single slow frame
// during a scene transition shouldn't trigger this) stretch below the
// threshold disables grain and fog once; it never re-enables itself
// automatically (that would fight the player's own Options choice) — a
// fresh scene load re-evaluates from the current Settings each time.
const LOW_FPS_THRESHOLD = 40;
const LOW_FPS_SUSTAINED_MS = 3000;

// PROMPTS P5.1's pause menu talks to whichever room/level is currently
// running through this small public surface rather than reaching into
// GameScene's private fields directly (PauseScene is a separate Scene
// instance — it can only call public methods on a Scene it looks up via
// `this.scene.get("Game")`).
export class GameScene extends Phaser.Scene {
  private grain?: GrainPipeline;
  private roomHandle?: TestRoomHandle;
  private debugHarness?: DebugHarness;
  private touchControls?: TouchControls;
  private pendingData: GameSceneData = {};
  private lowFpsMs = 0;
  private degraded = false;

  constructor() {
    super("Game");
  }

  // Phaser calls init(data) before preload(), but preload() itself gets no
  // arguments — this is the only place scene-start data reaches preload,
  // where a map key needs to be known in order to queue its asset loads.
  init(data: GameSceneData): void {
    this.pendingData = data;
  }

  preload(): void {
    if (this.pendingData.map) {
      preloadLevel(this, this.pendingData.map);
    }
  }

  create(data: GameSceneData): void {
    this.setupGrain();

    this.input.keyboard?.on("keydown-G", () => {
      this.grain?.toggleGrain();
    });
    this.input.keyboard?.on("keydown-ESC", () => this.openPause());
    this.input.gamepad?.on("down", (_pad: unknown, button: Phaser.Input.Gamepad.Button) => {
      if (button.index === 9) {
        // Start button — standard-mapping index across the common gamepads
        // Phaser's own gamepad plugin targets.
        this.openPause();
      }
    });

    if (data.map) {
      this.roomHandle = buildLevel(this, data.map);
      this.setupTouchControls();
      if (DEBUG) {
        this.debugHarness = new DebugHarness(this, { kind: "map", key: data.map });
      }
      return;
    }

    const roomKey = TEST_ROOMS.some((r) => r.key === data.room) ? (data.room as string) : DEFAULT_ROOM_KEY;
    const room = TEST_ROOMS.find((r) => r.key === roomKey)!;
    this.roomHandle = room.build(this) ?? undefined;

    if (DEBUG) {
      this.debugHarness = new DebugHarness(this, { kind: "room", key: roomKey });
    }
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.roomHandle?.update?.(dt);
    this.debugHarness?.update(dt);
    this.touchControls?.update(dt);
    this.checkPerformanceDegrade(delta);
  }

  restartCheckpoint(): void {
    this.roomHandle?.restartCheckpoint?.();
  }

  setMasterVolume(value: number): void {
    this.roomHandle?.setMasterVolume?.(value);
  }

  setHighContrast(value: boolean): void {
    this.roomHandle?.setHighContrast?.(value);
  }

  getGrainPipeline(): GrainPipeline | undefined {
    return this.grain;
  }

  private checkPerformanceDegrade(deltaMs: number): void {
    if (this.degraded) {
      return;
    }
    if (this.game.loop.actualFps < LOW_FPS_THRESHOLD) {
      this.lowFpsMs += deltaMs;
    } else {
      this.lowFpsMs = 0;
    }
    if (this.lowFpsMs >= LOW_FPS_SUSTAINED_MS) {
      this.degraded = true;
      this.grain?.setGrainEnabled(false);
      this.roomHandle?.setFogEnabled?.(false);
    }
  }

  private openPause(): void {
    if (this.scene.isPaused()) {
      return; // already paused (e.g. ESC held/repeated) — don't stack overlays
    }
    this.scene.pause();
    this.physics.pause();
    this.scene.launch("Pause", { gameSceneKey: this.scene.key });
  }

  // Touch controls only make sense for the real, data-driven levels a phone
  // player actually reaches (PROMPTS P5.1's verify step is specifically
  // "a friend plays Chapter 1... on... phone") — LevelHandle.inputMap is
  // undefined for TestRooms (P0.3's debug harness), so this no-ops there.
  private setupTouchControls(): void {
    if (!TouchControls.shouldShow(this)) {
      return;
    }
    const inputMap = this.roomHandle?.inputMap;
    if (inputMap) {
      this.touchControls = new TouchControls(this, inputMap);
    }
  }

  private setupGrain(): void {
    if (this.game.renderer.type !== Phaser.WEBGL) {
      // Post FX pipelines need WebGL; Canvas fallback just skips the mood layer.
      return;
    }

    const pipelines = (this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).pipelines;
    if (!pipelines.has("Grain")) {
      pipelines.addPostPipeline("Grain", GrainPipeline);
    }

    this.cameras.main.setPostPipeline("Grain");
    this.grain = this.cameras.main.getPostPipeline("Grain") as GrainPipeline;
    const settings = new SettingsSystem();
    this.grain.setGrainEnabled(settings.grainEnabled);
    this.grain.setHighContrast(settings.highContrast);
  }
}
