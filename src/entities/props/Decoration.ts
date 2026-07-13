import Phaser from "phaser";

export type DecorationVariant = "tree" | "rock" | "fencePost" | "bush";

// Lighter than Lexi's own near-black (0x0a0a0a) and gameplay props on
// purpose — a first pass at pure near-black decorations was nearly
// invisible against an also-near-black background (confirmed via a
// renderer screenshot, not assumed). Sitting a shade lighter reads as
// "midground silhouette" and keeps Lexi/interactive props as the visually
// darkest, most readable layer, matching fx/Parallax.ts's same
// atmospheric-perspective logic (farther/less-important = lighter).
const SILHOUETTE = 0x1c1c1c;
const SILHOUETTE_MID = 0x262626;

function buildTree(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const trunk = scene.add.rectangle(0, -8, 10, 26, SILHOUETTE_MID);
  const canopyLow = scene.add.triangle(0, -30, -34, 20, 0, -40, 34, 20, SILHOUETTE);
  const canopyMid = scene.add.triangle(0, -52, -26, 16, 0, -32, 26, 16, SILHOUETTE);
  const canopyTop = scene.add.triangle(0, -70, -18, 14, 0, -26, 18, 14, SILHOUETTE);
  return [trunk, canopyLow, canopyMid, canopyTop];
}

function buildRock(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const base = scene.add.ellipse(0, -6, 46, 24, SILHOUETTE);
  const bump = scene.add.ellipse(-10, -18, 26, 22, SILHOUETTE_MID);
  return [base, bump];
}

function buildFencePost(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const post = scene.add.rectangle(0, -20, 8, 44, SILHOUETTE_MID);
  const cap = scene.add.rectangle(0, -42, 14, 6, SILHOUETTE);
  return [post, cap];
}

function buildBush(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const a = scene.add.ellipse(-10, -8, 22, 16, SILHOUETTE);
  const b = scene.add.ellipse(8, -6, 26, 18, SILHOUETTE);
  const c = scene.add.ellipse(-2, -14, 20, 14, SILHOUETTE_MID);
  return [a, b, c];
}

const BUILDERS: Record<DecorationVariant, (scene: Phaser.Scene) => Phaser.GameObjects.GameObject[]> = {
  tree: buildTree,
  rock: buildRock,
  fencePost: buildFencePost,
  bush: buildBush,
};

// Pure background dressing (PROMPTS P4.3's "replace Chapter 1 greybox") —
// no physics body, no per-frame update, nothing else in the game reads a
// Decoration back. It only exists to sell "this is a forest," the same way
// every creature/prop here is a Phaser primitive-shape composition rather
// than a loaded sprite (see fx/Grain.ts, fx/Fog.ts for the same
// generate-it-in-code approach applied to post-fx instead of props).
export class Decoration {
  readonly gameObject: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, x: number, y: number, variant: DecorationVariant, scale = 1) {
    const parts = BUILDERS[variant](scene);
    this.gameObject = scene.add.container(x, y, parts);
    this.gameObject.setScale(scale);
  }
}
