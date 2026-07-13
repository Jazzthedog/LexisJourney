import Phaser from "phaser";
import { GrainPipeline } from "../fx/Grain";
import { DEBUG } from "../debug/flag";
import { DebugHarness } from "../debug/DebugHarness";
import { TEST_ROOMS, DEFAULT_ROOM_KEY, TestRoomHandle } from "../debug/TestRooms";
import { preloadLevel, buildLevel } from "../levels/LevelLoader";

interface GameSceneData {
  room?: string;
  map?: string;
}

export class GameScene extends Phaser.Scene {
  private grain?: GrainPipeline;
  private roomHandle?: TestRoomHandle;
  private debugHarness?: DebugHarness;
  private pendingData: GameSceneData = {};

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

    if (data.map) {
      this.roomHandle = buildLevel(this, data.map);
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
  }
}
