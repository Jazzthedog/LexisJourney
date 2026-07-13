import Phaser from "phaser";
import { createPlayerRig } from "../systems/PlayerRig";
import { PuzzleRegistry } from "../systems/PuzzleWiring";
import { CheckpointSystem, Snapshottable } from "../systems/CheckpointSystem";
import { SaveSystem } from "../systems/SaveSystem";
import { SettingsSystem } from "../systems/SettingsSystem";
import { ClueSystem } from "../systems/ClueSystem";
import { AudioSystem } from "../systems/AudioSystem";
import { Crate } from "../entities/props/Crate";
import { Ball } from "../entities/props/Ball";
import { Lever } from "../entities/props/Lever";
import { Gate } from "../entities/props/Gate";
import { PressurePlate } from "../entities/props/PressurePlate";
import { DigSpot } from "../entities/props/DigSpot";
import { WaterZone } from "../entities/props/WaterZone";
import { WindZone } from "../entities/props/WindZone";
import { TriggerZone } from "../entities/props/TriggerZone";
import { RevealTarget } from "../entities/props/RevealTarget";
import { FloatingLog } from "../entities/props/FloatingLog";
import { MemoryToken } from "../entities/props/MemoryToken";
import { Crow } from "../entities/creatures/Crow";
import { Owl, OWL_CATCH_RADIUS, OWL_SCARE_RADIUS } from "../entities/creatures/Owl";
import { Decoration, DecorationVariant } from "../entities/props/Decoration";
import { ScentSystem, ScentPoint } from "../systems/ScentSystem";
import { getPalette } from "../fx/Palette";
import { FogLayers } from "../fx/Fog";
import { ParallaxLayers } from "../fx/Parallax";
import type { Grabbable } from "../entities/props/Grabbable";
import type { SoundReactive } from "../entities/SoundReactive";
import type { InputMap } from "../systems/InputMap";

const DECORATION_VARIANTS: DecorationVariant[] = ["tree", "rock", "fencePost", "bush"];
function decorationVariantOf(value: unknown): DecorationVariant {
  return DECORATION_VARIANTS.includes(value as DecorationVariant) ? (value as DecorationVariant) : "tree";
}

// All levels currently share one placeholder tileset (no real art until
// P4.3) — this is a deliberate convention, not a limitation of the parser
// itself: any tile layer in the map is read generically. See levels/README.md.
const GROUND_TILESET_NAME = "ground"; // must match the "name" field on the tileset inside every .tmj
const GROUND_TILESET_KEY = "level-ground-tile";
const GROUND_TILESET_IMAGE_PATH = "tilesets/ground.png";

// P2.2's river-crossing test room used the same threshold — how long Lexi
// can be swimming (in a WaterZone, not grounded) before it counts as a fail.
const SUBMERSION_LIMIT_MS = 3500;

export interface LevelHandle {
  update: (dt: number) => void;
  // PROMPTS P5.1's pause-menu "Restart at Checkpoint" — the same fail path
  // every hazard already uses, just triggered by the player directly instead
  // of a swoop/current/timer.
  restartCheckpoint: () => void;
  // PROMPTS P5.1's Options volume slider, applied live to whatever level is
  // currently running (GameScene forwards it from PauseScene's OptionsPanel).
  setMasterVolume: (value: number) => void;
  // PROMPTS P5.1's high-contrast accessibility toggle — drops the per-map
  // ambient darkness overlay (fx/Palette.ts) to 0 (GrainPipeline's vignette
  // easing is handled separately, by whoever owns the pipeline).
  setHighContrast: (value: boolean) => void;
  // PROMPTS P5.1's TouchControls needs Lexi's own InputMap to feed virtual
  // input into — exposed here rather than having GameScene reach into
  // Lexi's private fields.
  inputMap: InputMap;
  // PROMPTS P5.1's performance auto-degrade (a sustained low framerate
  // disables fog, same trigger that disables grain via GrainPipeline).
  setFogEnabled: (value: boolean) => void;
}

export function preloadLevel(scene: Phaser.Scene, mapKey: string): void {
  scene.load.tilemapTiledJSON(mapKey, `levels/${mapKey}.tmj`);
  if (!scene.textures.exists(GROUND_TILESET_KEY)) {
    scene.load.image(GROUND_TILESET_KEY, GROUND_TILESET_IMAGE_PATH);
  }
}

function propsOf(obj: Phaser.Types.Tilemaps.TiledObject): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const raw = (obj.properties ?? []) as Array<{ name: string; value: unknown }>;
  for (const p of raw) {
    out[p.name] = p.value;
  }
  return out;
}

// Same shape as object properties, but read off the map itself (Tiled
// supports custom properties on the map, not just on individual objects) —
// used for chapter-level metadata like `chapter` (SaveSystem's progress key).
function mapPropsOf(map: Phaser.Tilemaps.Tilemap): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const raw = (map.properties ?? []) as Array<{ name: string; value: unknown }>;
  for (const p of raw) {
    out[p.name] = p.value;
  }
  return out;
}

// Tiled renamed "type" to "class" in 1.9+ but most JSON exports (and ours)
// still populate "type" — check both so a real Tiled re-export doesn't break.
function typeOf(obj: Phaser.Types.Tilemaps.TiledObject): string {
  return obj.type || (obj as unknown as { class?: string }).class || "";
}

function centerOf(obj: Phaser.Types.Tilemaps.TiledObject): { x: number; y: number } {
  const x = obj.x ?? 0;
  const y = obj.y ?? 0;
  const width = obj.width ?? 0;
  const height = obj.height ?? 0;
  if (width === 0 && height === 0) {
    return { x, y }; // point object — x,y already is the position
  }
  return { x: x + width / 2, y: y + height / 2 }; // rect object — x,y is top-left in Tiled
}

function targetList(value: unknown): string[] {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function positionSnapshot(
  gameObject: Phaser.GameObjects.GameObject & { x: number; y: number },
): Snapshottable<{ x: number; y: number }> {
  return {
    captureSnapshot: () => ({ x: gameObject.x, y: gameObject.y }),
    restoreSnapshot: (s) => {
      const body = (gameObject as unknown as { body: Phaser.Physics.Arcade.Body }).body;
      body.reset(s.x, s.y);
      body.velocity.set(0, 0);
    },
  };
}

// Parses a Tiled .tmj (loaded via preloadLevel) into a fully-built scene:
// tile layers become collision, object-layer entries spawn typed props/
// creatures from their Tiled `type` + `properties`, polyline objects become
// ScentSystem paths, and `targets` properties wire triggers to Targetables
// through the same PuzzleRegistry P2.1's hand-built rooms already use. See
// levels/README.md for the authoring conventions this expects.
export function buildLevel(scene: Phaser.Scene, mapKey: string): LevelHandle {
  const map = scene.make.tilemap({ key: mapKey });
  const tileset = map.addTilesetImage(GROUND_TILESET_NAME, GROUND_TILESET_KEY);
  if (!tileset) {
    throw new Error(`LevelLoader: map "${mapKey}" has no tileset named "${GROUND_TILESET_NAME}"`);
  }
  const chapter = str(mapPropsOf(map).chapter, mapKey);

  scene.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  scene.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

  // PROMPTS P4.3: per-map atmosphere. The ambient overlay is a plain
  // screen-fixed rectangle rather than a shader uniform (GrainPipeline
  // already owns the vignette) — depth 45 sits above gameplay/decorations
  // (0) but below the fog bands (50+), so fog still reads as glowing faintly
  // even through the darkened scene.
  const settings = new SettingsSystem();
  const palette = getPalette(mapKey);
  scene.cameras.main.setBackgroundColor(palette.backgroundColor);
  const { width: viewWidth, height: viewHeight } = scene.scale;
  const ambientOverlay = scene.add
    .rectangle(viewWidth / 2, viewHeight / 2, viewWidth, viewHeight, 0x000000, settings.highContrast ? 0 : palette.ambientDarkness)
    .setScrollFactor(0)
    .setDepth(45);
  const fog = new FogLayers(scene, viewWidth, viewHeight, palette.fogDensity);
  const parallax = new ParallaxLayers(scene, viewWidth, viewHeight, map.widthInPixels, map.heightInPixels);

  const tileLayers: Phaser.Tilemaps.TilemapLayer[] = [];
  for (const layerData of map.layers) {
    const layer = map.createLayer(layerData.name, tileset, 0, 0);
    if (!layer) {
      continue;
    }
    layer.setCollisionByExclusion([-1]);
    tileLayers.push(layer);
  }

  const registry = new PuzzleRegistry();
  const checkpointSystem = new CheckpointSystem(scene);
  const saveSystem = new SaveSystem();

  let spawnX = 100;
  let spawnY = 100;
  const grabCandidates: Grabbable[] = [];
  const soundReactive: SoundReactive[] = [];
  const digSpots: DigSpot[] = [];
  const waterZones: WaterZone[] = [];
  const windZones: WindZone[] = [];
  const pressurePlates: PressurePlate[] = [];
  const triggerZones: TriggerZone[] = [];
  const floatingLogs: FloatingLog[] = [];
  const memoryTokens: MemoryToken[] = [];
  const owls: Owl[] = [];
  const crows: Crow[] = [];
  const openGroundZones: Phaser.Geom.Rectangle[] = [];
  const collidableGameObjects: Phaser.GameObjects.GameObject[] = [];
  const weightBodies: Phaser.Physics.Arcade.Body[] = [];
  const scentPaths: ScentPoint[][] = [];

  for (const objectLayer of map.objects) {
    for (const obj of objectLayer.objects) {
      if (obj.polyline) {
        const originX = obj.x ?? 0;
        const originY = obj.y ?? 0;
        scentPaths.push(obj.polyline.map((p) => ({ x: originX + (p.x ?? 0), y: originY + (p.y ?? 0) })));
        continue;
      }

      const type = typeOf(obj);
      const props = propsOf(obj);
      const center = centerOf(obj);
      const width = obj.width ?? 0;
      const height = obj.height ?? 0;

      switch (type) {
        case "PlayerSpawn": {
          spawnX = center.x;
          spawnY = center.y;
          break;
        }
        case "Crate": {
          const crate = new Crate(scene, center.x, center.y);
          grabCandidates.push(crate);
          collidableGameObjects.push(crate.gameObject);
          weightBodies.push(crate.gameObject.body as Phaser.Physics.Arcade.Body);
          checkpointSystem.register(positionSnapshot(crate.gameObject));
          break;
        }
        case "Ball": {
          const ball = new Ball(scene, center.x, center.y);
          grabCandidates.push(ball);
          collidableGameObjects.push(ball.gameObject);
          weightBodies.push(ball.gameObject.body as Phaser.Physics.Arcade.Body);
          checkpointSystem.register(positionSnapshot(ball.gameObject));
          if (props.startHidden) {
            ball.gameObject.setVisible(false);
            (ball.gameObject.body as Phaser.Physics.Arcade.Body).enable = false;
            if (typeof props.targetId === "string") {
              registry.register(new RevealTarget(ball.gameObject, props.targetId));
            }
          }
          break;
        }
        case "Lever": {
          const lever = new Lever(scene, center.x, center.y, targetList(props.targets), registry);
          grabCandidates.push(lever);
          break;
        }
        case "Gate": {
          const targetId = typeof props.targetId === "string" ? props.targetId : obj.name;
          const gate = new Gate(scene, center.x, center.y, width, height, targetId);
          registry.register(gate);
          collidableGameObjects.push(gate.gameObject);
          break;
        }
        case "PressurePlate": {
          const plate = new PressurePlate(scene, center.x, center.y, width, targetList(props.targets), registry);
          pressurePlates.push(plate);
          break;
        }
        case "DigSpot": {
          const targets = targetList(props.targets);
          const spot = new DigSpot(scene, center.x, center.y, width, () => registry.activate(targets, true));
          digSpots.push(spot);
          break;
        }
        case "Crow": {
          const crow = new Crow(scene, center.x, center.y);
          soundReactive.push(crow);
          crows.push(crow);
          break;
        }
        case "Owl": {
          owls.push(new Owl(scene, center.x, center.y));
          break;
        }
        case "OpenGroundZone": {
          openGroundZones.push(new Phaser.Geom.Rectangle(obj.x ?? 0, obj.y ?? 0, width, height));
          break;
        }
        case "FloatingLog": {
          const log = new FloatingLog(scene, center.x, center.y, width, height, num(props.bobPeriodS, 2), num(props.phaseOffset, 0));
          floatingLogs.push(log);
          break;
        }
        case "MemoryToken": {
          const token = new MemoryToken(scene, center.x, center.y, str(props.tokenId, `${mapKey}_${obj.id}`));
          memoryTokens.push(token);
          if (props.startHidden) {
            token.gameObject.setVisible(false);
            if (typeof props.targetId === "string") {
              registry.register(new RevealTarget(token.gameObject, props.targetId));
            }
          }
          break;
        }
        case "WaterZone": {
          waterZones.push(new WaterZone(scene, center.x, center.y, width, height, num(props.currentVx, 0)));
          break;
        }
        case "WindZone": {
          windZones.push(
            new WindZone(
              scene,
              center.x,
              center.y,
              width,
              height,
              num(props.gustForceX, 0),
              num(props.intervalMs, 3000),
              num(props.telegraphMs, 500),
              num(props.gustDurationMs, 600),
            ),
          );
          break;
        }
        case "CheckpointZone": {
          const checkpointId = str(props.checkpointId, `${mapKey}_${obj.id}`);
          triggerZones.push(
            new TriggerZone(scene, center.x, center.y, width, height, () => {
              checkpointSystem.checkpoint();
              saveSystem.setCheckpoint(chapter, checkpointId, mapKey);
            }),
          );
          break;
        }
        case "FailZone": {
          triggerZones.push(new TriggerZone(scene, center.x, center.y, width, height, () => checkpointSystem.fail()));
          break;
        }
        case "MapExit": {
          const nextMap = props.nextMap;
          if (typeof nextMap !== "string" || nextMap.length === 0) {
            console.warn(`LevelLoader: MapExit (id=${obj.id}, map=${mapKey}) missing "nextMap" — skipped`);
            break;
          }
          triggerZones.push(
            new TriggerZone(scene, center.x, center.y, width, height, () => {
              scene.scene.restart({ map: nextMap });
            }),
          );
          break;
        }
        case "Decoration": {
          new Decoration(scene, center.x, center.y, decorationVariantOf(props.variant), num(props.scale, 1));
          break;
        }
        default:
          console.warn(`LevelLoader: unknown object type "${type}" (id=${obj.id}, map=${mapKey}) — skipped`);
      }
    }
  }

  const { lexi, updatePlayerAndCamera, input } = createPlayerRig(scene, spawnX, spawnY, {
    grabCandidates,
    soundReactive,
    digSpots,
    waterZones,
    windZones,
  });
  checkpointSystem.register(lexi);

  for (const layer of tileLayers) {
    scene.physics.add.collider(lexi, layer);
    for (const obj of collidableGameObjects) {
      scene.physics.add.collider(obj, layer);
    }
  }
  for (const obj of collidableGameObjects) {
    scene.physics.add.collider(lexi, obj);
  }
  // Floating logs are kinematic (they don't rest on the ground themselves,
  // per SPEC §5's physics note), so they only ever collide with what stands
  // on them, never with the tile layers.
  for (const log of floatingLogs) {
    scene.physics.add.collider(lexi, log.gameObject);
    for (const obj of collidableGameObjects) {
      scene.physics.add.collider(obj, log.gameObject);
    }
  }

  const scentSystem = scentPaths.length > 0 ? new ScentSystem(scene, scentPaths, saveSystem.tokenCount) : undefined;
  const audioSystem = new AudioSystem(scene);
  audioSystem.setMasterVolume(settings.masterVolume);
  audioSystem.setBed("forest");
  lexi.on("bark", () => audioSystem.playBark());

  const clueSystem = new ClueSystem(scene, lexi, saveSystem, scentSystem, audioSystem);
  for (const token of memoryTokens) {
    clueSystem.register(token);
  }

  checkpointSystem.checkpoint(); // spawn itself counts as checkpoint zero

  return {
    update: (dt: number) => {
      clueSystem.update(dt, lexi.x, lexi.y);
      if (clueSystem.isPaused) {
        return; // memory-echo vignette playing — the world holds still
      }

      updatePlayerAndCamera(dt);
      for (const log of floatingLogs) {
        log.update(dt);
      }
      for (const crow of crows) {
        crow.update(dt);
      }
      for (const zone of windZones) {
        zone.update(dt);
      }
      for (const plate of pressurePlates) {
        plate.update([lexi.body, ...weightBodies]);
      }
      for (const trigger of triggerZones) {
        trigger.update(lexi.body);
      }
      scentSystem?.update(dt, lexi.isSniffing);
      fog.update(dt);
      parallax.update(dt, scene.cameras.main.scrollX);

      let threatened = false;
      for (const owl of owls) {
        owl.update(dt);
        if (owl.isPerched && openGroundZones.some((zone) => Phaser.Geom.Rectangle.Contains(zone, lexi.x, lexi.y))) {
          owl.triggerSwoop(lexi.x, lexi.y);
        }
        if (owl.isSwooping) {
          const dist = Phaser.Math.Distance.Between(owl.x, owl.y, lexi.x, lexi.y);
          if (dist < OWL_CATCH_RADIUS) {
            checkpointSystem.fail();
          } else if (dist < OWL_SCARE_RADIUS) {
            threatened = true;
          }
        }
      }
      lexi.setThreatened(threatened);

      if (waterZones.length > 0) {
        const inWater = waterZones.some((zone) => zone.contains(lexi.x, lexi.y));
        audioSystem.setBed(inWater ? "river" : "forest");
        if (lexi.waterSubmersionMs > SUBMERSION_LIMIT_MS) {
          checkpointSystem.fail();
        }
      }
    },
    restartCheckpoint: () => checkpointSystem.fail(),
    setMasterVolume: (value: number) => audioSystem.setMasterVolume(value),
    setHighContrast: (value: boolean) => ambientOverlay.setAlpha(value ? 0 : palette.ambientDarkness),
    inputMap: input,
    setFogEnabled: (value: boolean) => fog.setEnabled(value),
  };
}
