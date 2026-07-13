// Shared contract for anything a Lever/PressurePlate can drive by string id —
// this is the seam PROMPTS.md P2.1 calls out so Tiled object properties can
// wire triggers to targets later (`lever_01 targets gate_01`) without new
// code: a level just needs matching targetId strings.
export interface Targetable {
  readonly targetId: string;
  setActivated(activated: boolean): void;
}

export class PuzzleRegistry {
  private readonly targets = new Map<string, Targetable[]>();

  register(target: Targetable): void {
    const list = this.targets.get(target.targetId) ?? [];
    list.push(target);
    this.targets.set(target.targetId, list);
  }

  activate(targetIds: readonly string[], activated: boolean): void {
    for (const id of targetIds) {
      for (const target of this.targets.get(id) ?? []) {
        target.setActivated(activated);
      }
    }
  }
}
