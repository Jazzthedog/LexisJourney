import Phaser from "phaser";

// Vignette is always on; uGrainEnabled only gates the noise term so the
// debug G-key toggle (GameScene) affects grain without touching the vignette.
const fragShader = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uTime;
uniform float uGrainEnabled;

varying vec2 outTexCoord;

float random(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main(void) {
  vec4 color = texture2D(uMainSampler, outTexCoord);

  vec2 centered = outTexCoord - 0.5;
  float vignette = smoothstep(0.75, 0.25, length(centered));
  color.rgb *= mix(0.35, 1.0, vignette);

  float grain = (random(outTexCoord * uTime * 100.0) - 0.5) * 0.12;
  color.rgb += grain * uGrainEnabled;

  gl_FragColor = color;
}
`;

export class GrainPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  private grainEnabled = true;

  constructor(game: Phaser.Game) {
    super({
      game,
      fragShader,
    });
  }

  onPreRender(): void {
    this.set1f("uTime", this.game.loop.time / 1000);
    this.set1f("uGrainEnabled", this.grainEnabled ? 1 : 0);
  }

  toggleGrain(): boolean {
    this.grainEnabled = !this.grainEnabled;
    return this.grainEnabled;
  }
}
