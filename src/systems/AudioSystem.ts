import Phaser from "phaser";
import { createNoiseBuffer, playTone, playFilteredNoise } from "../fx/AudioSynth";

export type SurfaceType = "grass" | "wood" | "metal";
export type OneShotKind = "creak" | "splash" | "chainRattle";

interface BedPreset {
  rumbleFreq: number;
  rumbleLevel: number;
  noiseFilterType: BiquadFilterType;
  noiseFilterFreq: number;
  noiseLevel: number;
}

// Placeholder ambient beds — a low sine "room tone" plus filtered looping
// noise, distinct enough per key to be tell-apart-with-eyes-closed (river's
// noise is brighter/louder, reading as rushing water vs forest's dull hush).
const BED_PRESETS: Record<string, BedPreset> = {
  forest: { rumbleFreq: 70, rumbleLevel: 0.035, noiseFilterType: "lowpass", noiseFilterFreq: 700, noiseLevel: 0.045 },
  river: { rumbleFreq: 55, rumbleLevel: 0.04, noiseFilterType: "lowpass", noiseFilterFreq: 2600, noiseLevel: 0.15 },
};

const BED_NOISE_BUFFER_S = 4;
const BED_CROSSFADE_S = 1.2;
const MASTER_GAIN = 0.6;
const MAX_HEARING_DISTANCE = 900; // px — positional sounds fade to silence beyond this
const PAN_SPREAD_PX = 400; // horizontal offset that reaches full stereo pan

const WHISTLE_NOTES = [523.25, 659.25, 784.0, 1046.5]; // C5 E5 G5 C6 — SPEC's 4-note family whistle motif
const WHISTLE_NOTE_S = 0.18;
const WHISTLE_GAP_S = 0.04;

interface ActiveBed {
  key: string;
  rumbleOsc: OscillatorNode;
  noiseSrc: AudioBufferSourceNode;
  gain: GainNode;
}

interface ActiveDrone {
  key: string;
  worldX: number;
  worldY: number;
  noiseSrc: AudioBufferSourceNode;
  gain: GainNode;
  panner: StereoPannerNode;
  baseGain: number;
}

function randomOffset(bufferDurationS: number): number {
  return Math.random() * bufferDurationS;
}

// Placeholder audio — see fx/AudioSynth.ts and CREDITS.md. Everything here
// is synthesized in code (no loaded files), matching the project's existing
// procedural-placeholder pattern (Grain's shader noise, Fog's canvas
// texture) until a real CC0 sourcing pass replaces it. Public API is what
// PROMPTS P3.3 asks for: crossfading ambient beds, positional one-shots,
// surface-aware footsteps, bark, and the whistle motif.
export class AudioSystem {
  private readonly ctx: AudioContext;
  private readonly masterGain: GainNode;
  private readonly noiseBuffer: AudioBuffer;
  private activeBed: ActiveBed | null = null;
  private currentBedKey: string | null = null;
  private activeDrone: ActiveDrone | null = null;

  constructor(scene: Phaser.Scene) {
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextCtor();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = MASTER_GAIN;
    this.masterGain.connect(this.ctx.destination);
    this.noiseBuffer = createNoiseBuffer(this.ctx, BED_NOISE_BUFFER_S);

    // Autoplay policy: an AudioContext starts (or resumes after a scene
    // restart re-creates it) suspended until a real user gesture. Any key
    // or click resumes it — cheap and harmless to attach repeatedly.
    const resume = () => {
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    };
    scene.input.keyboard?.on("keydown", resume);
    scene.input.on("pointerdown", resume);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  // Looping ambient bed per level/region, crossfaded rather than cut.
  setBed(key: string): void {
    if (this.currentBedKey === key) {
      return;
    }
    const preset = BED_PRESETS[key];
    if (!preset) {
      console.warn(`AudioSystem: unknown bed "${key}"`);
      return;
    }
    this.currentBedKey = key;
    const now = this.ctx.currentTime;

    const newGain = this.ctx.createGain();
    newGain.gain.setValueAtTime(0, now);
    newGain.gain.linearRampToValueAtTime(1, now + BED_CROSSFADE_S);
    newGain.connect(this.masterGain);

    const rumbleOsc = this.ctx.createOscillator();
    rumbleOsc.type = "sine";
    rumbleOsc.frequency.value = preset.rumbleFreq;
    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.value = preset.rumbleLevel;
    rumbleOsc.connect(rumbleGain).connect(newGain);
    rumbleOsc.start(now);

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;
    noiseSrc.loop = true;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = preset.noiseFilterType;
    noiseFilter.frequency.value = preset.noiseFilterFreq;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = preset.noiseLevel;
    noiseSrc.connect(noiseFilter).connect(noiseGain).connect(newGain);
    noiseSrc.start(now);

    const old = this.activeBed;
    this.activeBed = { key, rumbleOsc, noiseSrc, gain: newGain };

    if (old) {
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + BED_CROSSFADE_S);
      const stopAt = now + BED_CROSSFADE_S + 0.05;
      old.rumbleOsc.stop(stopAt);
      old.noiseSrc.stop(stopAt);
    }
  }

  playFootstep(surface: SurfaceType): void {
    switch (surface) {
      case "grass":
        playFilteredNoise(this.ctx, this.masterGain, this.noiseBuffer, {
          duration: 0.09,
          filterType: "lowpass",
          filterFreq: 700,
          peakGain: 0.12,
          attack: 0.006,
          offset: randomOffset(BED_NOISE_BUFFER_S),
        });
        break;
      case "wood":
        playFilteredNoise(this.ctx, this.masterGain, this.noiseBuffer, {
          duration: 0.07,
          filterType: "bandpass",
          filterFreq: 1400,
          filterQ: 3,
          peakGain: 0.16,
          attack: 0.003,
          offset: randomOffset(BED_NOISE_BUFFER_S),
        });
        break;
      case "metal":
        playFilteredNoise(this.ctx, this.masterGain, this.noiseBuffer, {
          duration: 0.06,
          filterType: "highpass",
          filterFreq: 2800,
          peakGain: 0.14,
          attack: 0.002,
          offset: randomOffset(BED_NOISE_BUFFER_S),
        });
        playTone(this.ctx, this.masterGain, {
          freq: 2200,
          freqEnd: 1800,
          duration: 0.08,
          type: "triangle",
          peakGain: 0.05,
          attack: 0.001,
        });
        break;
    }
  }

  playBark(): void {
    playTone(this.ctx, this.masterGain, { freq: 320, freqEnd: 150, duration: 0.14, type: "sawtooth", peakGain: 0.18, attack: 0.005 });
    playFilteredNoise(this.ctx, this.masterGain, this.noiseBuffer, {
      duration: 0.1,
      filterType: "bandpass",
      filterFreq: 900,
      filterQ: 2,
      peakGain: 0.08,
      attack: 0.002,
      offset: randomOffset(BED_NOISE_BUFFER_S),
    });
  }

  playWhistleMotif(): void {
    WHISTLE_NOTES.forEach((freq, i) => {
      playTone(this.ctx, this.masterGain, {
        freq,
        duration: WHISTLE_NOTE_S,
        type: "sine",
        peakGain: 0.22,
        attack: 0.02,
        startDelay: i * (WHISTLE_NOTE_S + WHISTLE_GAP_S),
      });
    });
  }

  // A discrete, positional environmental sound — volume/pan computed from
  // distance and horizontal offset to the listener (Lexi), same falloff
  // math the positional drone uses.
  playOneShot(kind: OneShotKind, worldX: number, worldY: number, listenerX: number, listenerY: number): void {
    const { gain, pan } = this.computePositional(worldX, worldY, listenerX, listenerY, 1);
    if (gain <= 0.001) {
      return;
    }
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(this.masterGain);

    switch (kind) {
      case "creak":
        playTone(this.ctx, panner, { freq: 160, freqEnd: 105, duration: 0.45, type: "sine", peakGain: 0.25 * gain, attack: 0.05 });
        break;
      case "splash":
        playFilteredNoise(this.ctx, panner, this.noiseBuffer, {
          duration: 0.35,
          filterType: "bandpass",
          filterFreq: 1200,
          filterQ: 0.7,
          peakGain: 0.3 * gain,
          attack: 0.01,
          offset: randomOffset(BED_NOISE_BUFFER_S),
        });
        break;
      case "chainRattle":
        for (let i = 0; i < 4; i++) {
          playFilteredNoise(this.ctx, panner, this.noiseBuffer, {
            duration: 0.05,
            filterType: "highpass",
            filterFreq: 2000,
            peakGain: 0.16 * gain,
            attack: 0.002,
            startDelay: i * 0.06,
            offset: randomOffset(BED_NOISE_BUFFER_S),
          });
        }
        break;
    }
  }

  // A persistent looping positional sound anchored at a world point (e.g. a
  // WaterZone) — unlike playOneShot, this keeps playing and its gain is
  // re-evaluated every updateDrone() call, so a player can locate the
  // source by ear alone as they move relative to it.
  setPositionalDrone(key: string, worldX: number, worldY: number): void {
    if (this.activeDrone?.key === key) {
      this.activeDrone.worldX = worldX;
      this.activeDrone.worldY = worldY;
      return;
    }
    this.clearPositionalDrone();

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;
    noiseSrc.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1400;
    filter.Q.value = 0.6;
    const panner = this.ctx.createStereoPanner();
    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    noiseSrc.connect(filter).connect(gain).connect(panner).connect(this.masterGain);
    noiseSrc.start(this.ctx.currentTime);

    this.activeDrone = { key, worldX, worldY, noiseSrc, gain, panner, baseGain: 0.5 };
  }

  clearPositionalDrone(): void {
    if (!this.activeDrone) {
      return;
    }
    this.activeDrone.noiseSrc.stop();
    this.activeDrone = null;
  }

  // Call every frame with the listener's (Lexi's) world position while a
  // positional drone is active.
  updateDrone(listenerX: number, listenerY: number): void {
    if (!this.activeDrone) {
      return;
    }
    const { gain, pan } = this.computePositional(this.activeDrone.worldX, this.activeDrone.worldY, listenerX, listenerY, this.activeDrone.baseGain);
    this.activeDrone.gain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.15);
    this.activeDrone.panner.pan.setTargetAtTime(pan, this.ctx.currentTime, 0.15);
  }

  private computePositional(sourceX: number, sourceY: number, listenerX: number, listenerY: number, baseGain: number): { gain: number; pan: number } {
    const dist = Phaser.Math.Distance.Between(sourceX, sourceY, listenerX, listenerY);
    const falloff = Phaser.Math.Clamp(1 - dist / MAX_HEARING_DISTANCE, 0, 1);
    const pan = Phaser.Math.Clamp((sourceX - listenerX) / PAN_SPREAD_PX, -1, 1);
    return { gain: baseGain * falloff, pan };
  }

  destroy(): void {
    this.clearPositionalDrone();
    if (this.ctx.state !== "closed") {
      this.ctx.close();
    }
  }
}
