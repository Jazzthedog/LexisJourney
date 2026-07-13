const STORAGE_KEY = "lexis-journey-save-v1";

export interface SaveData {
  chapter: string;
  checkpoint: string;
  tokens: string[];
  hasSeenIntro: boolean;
}

const EMPTY_SAVE: SaveData = { chapter: "", checkpoint: "", tokens: [], hasSeenIntro: false };

function loadFromStorage(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...EMPTY_SAVE, tokens: [] };
    }
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      chapter: typeof parsed.chapter === "string" ? parsed.chapter : "",
      checkpoint: typeof parsed.checkpoint === "string" ? parsed.checkpoint : "",
      tokens: Array.isArray(parsed.tokens) ? parsed.tokens.filter((t): t is string => typeof t === "string") : [],
      hasSeenIntro: parsed.hasSeenIntro === true,
    };
  } catch {
    // Corrupt or pre-schema-change data — a fresh save beats a crash.
    return { ...EMPTY_SAVE, tokens: [] };
  }
}

// The only persistent (cross-reload) store in the game — localStorage per
// SPEC §5, no backend. Everything else (CheckpointSystem's snapshots) is
// runtime-only respawn state that a page reload legitimately discards; this
// is the opposite: it's specifically for surviving a reload.
export class SaveSystem {
  private data: SaveData;

  constructor() {
    this.data = loadFromStorage();
  }

  get chapter(): string {
    return this.data.chapter;
  }

  get checkpoint(): string {
    return this.data.checkpoint;
  }

  get tokenCount(): number {
    return this.data.tokens.length;
  }

  get hasSeenIntro(): boolean {
    return this.data.hasSeenIntro;
  }

  markIntroSeen(): void {
    if (this.data.hasSeenIntro) {
      return;
    }
    this.data.hasSeenIntro = true;
    this.persist();
  }

  hasToken(id: string): boolean {
    return this.data.tokens.includes(id);
  }

  addToken(id: string): void {
    if (this.hasToken(id)) {
      return;
    }
    this.data.tokens.push(id);
    this.persist();
  }

  setCheckpoint(chapter: string, checkpoint: string): void {
    this.data.chapter = chapter;
    this.data.checkpoint = checkpoint;
    this.persist();
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }
}
