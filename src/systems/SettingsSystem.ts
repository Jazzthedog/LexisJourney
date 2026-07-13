const STORAGE_KEY = "lexis-journey-settings-v1";

export interface Settings {
  masterVolume: number; // 0..1
  grainEnabled: boolean;
  highContrast: boolean; // accessibility: less vignette darkening, no ambient overlay
}

const DEFAULT_SETTINGS: Settings = { masterVolume: 0.8, grainEnabled: true, highContrast: false };

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      masterVolume: typeof parsed.masterVolume === "number" ? clamp01(parsed.masterVolume) : DEFAULT_SETTINGS.masterVolume,
      grainEnabled: typeof parsed.grainEnabled === "boolean" ? parsed.grainEnabled : DEFAULT_SETTINGS.grainEnabled,
      highContrast: typeof parsed.highContrast === "boolean" ? parsed.highContrast : DEFAULT_SETTINGS.highContrast,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// Player preferences (PROMPTS P5.1's Options menu) — deliberately a separate
// localStorage key from SaveSystem's progress blob: resetting a save
// ("New Game") should never silently reset volume/accessibility choices,
// and vice versa.
export class SettingsSystem {
  private data: Settings;

  constructor() {
    this.data = loadFromStorage();
  }

  get masterVolume(): number {
    return this.data.masterVolume;
  }

  get grainEnabled(): boolean {
    return this.data.grainEnabled;
  }

  get highContrast(): boolean {
    return this.data.highContrast;
  }

  setMasterVolume(value: number): void {
    this.data.masterVolume = clamp01(value);
    this.persist();
  }

  setGrainEnabled(value: boolean): void {
    this.data.grainEnabled = value;
    this.persist();
  }

  setHighContrast(value: boolean): void {
    this.data.highContrast = value;
    this.persist();
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }
}
