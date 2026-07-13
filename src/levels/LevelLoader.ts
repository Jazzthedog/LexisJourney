import Phaser from "phaser";
import { createPlayerRig } from "../systems/PlayerRig";
import { PuzzleRegistry } from "../systems/PuzzleWiring";
import { CheckpointSystem, Snapshottable } from "../systems/CheckpointSystem";
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
import { Crow } from "../entities/creatures/Crow";
import { ScentSystem, ScentPoint } from "../systems/ScentSystem";
import type { Grabbable } from "../entities/props/Grabbable";
import type { SoundReactive } from "../entities/SoundReactive";

// All levels currently share one placeholder tileset (no real art until
// P4.3) — this is a deliberate convention, not a limitation of the parser
// itself: any tile layer in the map is read generically. See levels/README.md.
const GROUND_TILESET_NAME = "ground"; // must match the "name" field on the tileset inside every .tmj
const GROUND_TILESET_KEY = "level-ground-tile";
const GROUND_TILESET_IMAGE_PATH = "tilesets/ground.png";

export interface LevelHandle {
  update: (dt: number) => void;
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

  scene.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  scene.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

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

  let spawnX = 100;
  let spawnY = 100;
  const grabCandidates: Grabbable[] = [];
  const soundReactive: SoundReactive[] = [];
  const digSpots: DigSpot[] = [];
  const waterZones: WaterZone[] = [];
  const windZones: WindZone[] = [];
  const pressurePlates: PressurePlate[] = [];
  const triggerZones: TriggerZone[] = [];
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
          triggerZones.push(new TriggerZone(scene, center.x, center.y, width, height, () => checkpointSystem.checkpoint()));
          break;
        }
        case "FailZone": {
          triggerZones.push(new TriggerZone(scene, center.x, center.y, width, height, () => checkpointSystem.fail()));
          break;
        }
        default:
          console.warn(`LevelLoader: unknown object type "${type}" (id=${obj.id}, map=${mapKey}) — skipped`);
      }
    }
  }

  const { lexi, updatePlayerAndCamera } = createPlayerRig(scene, spawnX, spawnY, {
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

  const scentSystem = scentPaths.length > 0 ? new ScentSystem(scene, scentPaths) : null;

  checkpointSystem.checkpoint(); // spawn itself counts as checkpoint zero

  return {
    update: (dt: number) => {
      updatePlayerAndCamera(dt);
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
    },
  };
}
