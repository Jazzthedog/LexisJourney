// Raw Web Audio synthesis primitives — no external files. Same "generate the
// primitive in code" approach as Grain.ts (shader noise) and Fog.ts (canvas
// blob texture): placeholder audio until a real CC0 sourcing pass swaps
// these for sampled sounds (see CREDITS.md). Every helper here is a single
// fire-and-forget node graph; nothing is kept alive past its own envelope.

export function createNoiseBuffer(ctx: AudioContext, durationSeconds: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export interface ToneOptions {
  freq: number;
  duration: number; // seconds
  type?: OscillatorType;
  peakGain?: number;
  attack?: number; // seconds
  freqEnd?: number; // optional linear pitch slide target
  startDelay?: number; // seconds from now — for scheduling a sequence sample-accurately
}

export function playTone(ctx: AudioContext, destination: AudioNode, opts: ToneOptions): void {
  const { freq, duration, type = "sine", peakGain = 0.3, attack = 0.01, freqEnd, startDelay = 0 } = opts;
  const start = ctx.currentTime + startDelay;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd !== undefined) {
    osc.frequency.linearRampToValueAtTime(freqEnd, start + duration);
  }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain).connect(destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export interface FilteredNoiseOptions {
  duration: number; // seconds
  filterType?: BiquadFilterType;
  filterFreq: number;
  filterQ?: number;
  peakGain?: number;
  attack?: number; // seconds
  startDelay?: number; // seconds from now
  offset?: number; // seconds into noiseBuffer to start reading from
}

export function playFilteredNoise(
  ctx: AudioContext,
  destination: AudioNode,
  noiseBuffer: AudioBuffer,
  opts: FilteredNoiseOptions,
): void {
  const {
    duration,
    filterType = "lowpass",
    filterFreq,
    filterQ = 1,
    peakGain = 0.3,
    attack = 0.005,
    startDelay = 0,
    offset = 0,
  } = opts;
  const start = ctx.currentTime + startDelay;

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = false;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  filter.Q.value = filterQ;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  src.connect(filter).connect(gain).connect(destination);
  src.start(start, offset % Math.max(0.001, noiseBuffer.duration - duration));
  src.stop(start + duration + 0.05);
}
