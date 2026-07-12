import Phaser from "phaser";
import { GrainPipeline } from "../fx/Grain";
import { DEBUG } from "../debug/flag";
import { DebugHarness } from "../debug/DebugHarness";
import { TEST_ROOMS, DEFAULT_ROOM_KEY, TestRoomHandle } from "../debug/TestRooms";

interface GameSceneData {
  room?: string;
}

export class GameScene extends Phaser.Scene {
  private grain?: GrainPipeline;
  private roomHandle?: TestRoomHandle;
  private debugHarness?: DebugHarness;

  constructor() {
    super("Game");
  }

  create(data: GameSceneData): void {
    const roomKey = TEST_ROOMS.some((r) => r.key === data.room) ? (data.room as string) : DEFAULT_ROOM_KEY;

    this.setupGrain();

    const room = TEST_ROOMS.find((r) => r.key === roomKey)!;
    this.roomHandle = room.build(this) ?? undefined;

    this.input.keyboard?.on("keydown-G", () => {
      this.grain?.toggleGrain();
    });

    if (DEBUG) {
      this.debugHarness = new DebugHarness(this, roomKey);
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
