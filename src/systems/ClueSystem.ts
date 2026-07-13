import Phaser from "phaser";
import type { MemoryToken } from "../entities/props/MemoryToken";
import { MemoryEchoVignette } from "../fx/MemoryEchoVignette";
import type { SaveSystem } from "./SaveSystem";
import type { ScentSystem } from "./ScentSystem";
import type { AudioSystem } from "./AudioSystem";

const PICKUP_RANGE = 40; // px

// Orchestrates Memory Token pickup (SPEC §2): registers tokens (restoring
// already-collected ones from a prior session via SaveSystem so they just
// aren't there), detects Lexi walking up to an uncollected one, and on
// pickup persists it, re-applies the permanent ScentSystem buff live, plays
// the whistle motif (P3.3 — SPEC's family whistle "recurs" at every memory
// echo, not just the ending), and plays the memory-echo vignette itself.
// "Gameplay pauses" means the physics world itself, not just skipping the
// room's own update wrapper — Arcade integrates gravity/velocity every step
// regardless of whether anyone calls lexi.update(), so a token grabbed
// mid-run would otherwise keep sliding under her last velocity for the
// whole vignette. The room is still responsible for skipping its own
// per-frame calls (camera follow, creature AI) while `isPaused`, but the
// actual freeze lives here.
export class ClueSystem {
  private readonly scene: Phaser.Scene;
  private readonly saveSystem: SaveSystem;
  private readonly scentSystem?: ScentSystem;
  private readonly audioSystem?: AudioSystem;
  private readonly tokens: MemoryToken[] = [];
  private vignette: MemoryEchoVignette | null = null;

  constructor(scene: Phaser.Scene, saveSystem: SaveSystem, scentSystem?: ScentSystem, audioSystem?: AudioSystem) {
    this.scene = scene;
    this.saveSystem = saveSystem;
    this.scentSystem = scentSystem;
    this.audioSystem = audioSystem;
    this.scentSystem?.setTokenBuff(saveSystem.tokenCount);
  }

  register(token: MemoryToken): void {
    if (this.saveSystem.hasToken(token.id)) {
      token.markCollected();
    }
    this.tokens.push(token);
  }

  get isPaused(): boolean {
    return this.vignette !== null;
  }

  update(deltaSeconds: number, lexiX: number, lexiY: number): void {
    if (this.vignette) {
      this.vignette.update(deltaSeconds);
      return;
    }

    for (const token of this.tokens) {
      // A token can be spawned invisible (P4.1: buried, revealed by a
      // DigSpot's `targets`) — not visible yet means not pickupable yet,
      // even if Lexi's standing right on top of where it's buried.
      if (token.isCollected || !token.gameObject.visible) {
        continue;
      }
      const dist = Phaser.Math.Distance.Between(lexiX, lexiY, token.gameObject.x, token.gameObject.y);
      if (dist <= PICKUP_RANGE) {
        this.collect(token);
        return;
      }
    }
  }

  private collect(token: MemoryToken): void {
    token.markCollected();
    this.saveSystem.addToken(token.id);
    this.scentSystem?.setTokenBuff(this.saveSystem.tokenCount);
    this.audioSystem?.playWhistleMotif();
    this.scene.physics.pause();
    this.vignette = new MemoryEchoVignette(this.scene, () => {
      this.vignette = null;
      this.scene.physics.resume();
    });
  }
}
