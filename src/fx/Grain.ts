import Phaser from "phaser";

// Vignette is always on; uGrainEnabled only gates the noise term so the
// debug G-key toggle (GameScene) affects grain without touching the
// vignette. uHighContrast (PROMPTS P5.1's accessibility option) instead
// shrinks the vignette's darkening range — 0.35..1.0 becomes 0.7..1.0 — so
// silhouettes at the frame edges stay readable rather than crushed to near-
// black, without removing the vignette's shape entirely.
const fragShader = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uTime;
uniform float uGrainEnabled;
uniform float uHighContrast;

varying vec2 outTexCoord;

float random(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main(void) {
  vec4 color = texture2D(uMainSampler, outTexCoord);

  vec2 centered = outTexCoord - 0.5;
  float vignette = smoothstep(0.75, 0.25, length(centered));
  float vignetteFloor = mix(0.55, 0.8, uHighContrast);
  color.rgb *= mix(vignetteFloor, 1.0, vignette);

  // uTime grows for the entire lifetime of the page (never resets between
  // scenes). Feeding it raw into sin()-based random() drives the argument
  // into the tens of thousands within a few minutes of real play; at
  // mediump precision (~10-bit mantissa, required here for broad GPU
  // compatibility) sin()'s range reduction at that magnitude collapses many
  // distinct pixels to the same quantized output, turning per-pixel grain
  // into visible banding. Wrapping keeps the argument small (safe for
  // mediump) with no visible seam, since this is frame-to-frame static
  // noise, not a smooth animation.
  float wrappedTime = mod(uTime, 10.0);
  float grain = (random(outTexCoord * wrappedTime * 100.0) - 0.5) * 0.02;
  color.rgb += grain * uGrainEnabled;

  gl_FragColor = color;
}
`;

export class GrainPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private grainEnabled = true;
  private highContrastEnabled = false;

  constructor(game: Phaser.Game) {
    super({
      game,
      fragShader,
    });
  }

  onPreRender(): void {
    this.set1f("uTime", this.game.loop.time / 1000);
    this.set1f("uGrainEnabled", this.grainEnabled ? 1 : 0);
    this.set1f("uHighContrast", this.highContrastEnabled ? 1 : 0);
  }

  toggleGrain(): boolean {
    this.grainEnabled = !this.grainEnabled;
    return this.grainEnabled;
  }

  setGrainEnabled(value: boolean): void {
    this.grainEnabled = value;
  }

  isGrainEnabled(): boolean {
    return this.grainEnabled;
  }

  setHighContrast(value: boolean): void {
    this.highContrastEnabled = value;
  }
}
