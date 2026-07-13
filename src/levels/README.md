# Level authoring (Tiled)

`LevelLoader.ts` parses a Tiled JSON map (`.tmj`) into a fully-built `GameScene` — tile
layers become collision, object-layer entries spawn typed props/creatures from their Tiled
`type` + `properties`, polylines become scent trails, and puzzle triggers wire to targets by
string id. New content should mean a new `.tmj` file, not new TypeScript.

## File locations

- Map data: `public/levels/<mapKey>.tmj` — loaded at runtime via Phaser's asset loader, so it
  lives under `public/`, not `src/`.
- Shared placeholder tileset: `public/tilesets/ground.png` (32×32, solid `#333333`).
- Loader code: `src/levels/LevelLoader.ts`.

To play a map: `this.scene.start("Game", { map: "ch1_senses" })` (or restart with the same
data). The debug harness's `R` key restarts whatever's currently running — room or map — and
digit keys still jump between the P0.3 test rooms.

## Tile layers

Any layer with `"type": "tilelayer"` is collidable — every non-empty cell becomes solid
ground, and the tile image itself *is* the visual (no separate art layer needed at this
stage). All maps currently share one tileset, named `ground` (must match the tileset's
`"name"` field in the `.tmj`, since `LevelLoader` looks it up by that name), backed by
`public/tilesets/ground.png` — a 32×128 vertical strip of 4 tile variants (PROMPTS P4.3):
GID 1 = dirt/forest floor, GID 2 = rock (elevated ledges, spurs), GID 3 = fence-ground
(around a `Gate` styled as a fence), GID 4 = underbrush (safety floors — a visual cue that
you fell). `firstgid: 1`, `columns: 1`, `tilecount: 4` in every map's `tilesets` entry.
Which GID a given ground row paints is purely an authoring choice (the collision code
treats every non-zero GID identically) — see `make-chapter1.mjs`'s `paintRow(..., tile)`
param for the generator-script convention. Regenerate the tileset image itself via the
scratchpad's `make-ground-tileset.mjs` (a hand-rolled PNG encoder — no canvas/pngjs
dependency, matching this project's generate-placeholder-art-in-code convention).

## Object layers

Any object layer works — `LevelLoader` reads every object across every `objectgroup`,
regardless of layer name. An object's Tiled **Type** field (Tiled 1.9+ calls this "Class")
selects which entity class it spawns; **Properties** configure it.

Coordinates: rectangle objects use Tiled's top-left `x,y` + `width,height` — the loader
converts to the center coordinates every prop constructor expects. Point objects (`width`
and `height` both 0) use `x,y` directly.

| Type | Shape | Properties | Spawns |
|---|---|---|---|
| `PlayerSpawn` | point | — | Sets Lexi's spawn position. Exactly one per map. |
| `Crate` | point/rect | — | `props/Crate.ts`, draggable, checkpoint-restorable. |
| `Ball` | point/rect | `startHidden` (bool), `targetId` (string) | `props/Ball.ts`. If `startHidden`, spawns invisible + disabled and registers a `RevealTarget` under `targetId` — a matching trigger's `targets` reveals it. |
| `Lever` | point | `targets` (comma-separated string) | `props/Lever.ts`, bite-and-pull toggle. |
| `Gate` | rect | `targetId` (string, falls back to the object's Tiled name) | `props/Gate.ts`, a `Targetable` barrier. |
| `PressurePlate` | rect | `targets` (comma-separated string) | `props/PressurePlate.ts`. Weighted by Lexi and by any spawned `Crate`/`Ball`. |
| `DigSpot` | rect | `targets` (comma-separated string) | `props/DigSpot.ts`. Digging activates every listed target once (a one-shot reveal/open, never deactivates). |
| `FloatingLog` | rect | `bobPeriodS`, `phaseOffset` (numbers, default 2 / 0) | `props/FloatingLog.ts`. Only collides with what stands on it, never the tile layers (it's kinematic, not resting ground). |
| `MemoryToken` | point | `tokenId` (string, falls back to `<mapKey>_<objectId>`), `startHidden` (bool), `targetId` (string) | `props/MemoryToken.ts`, registered with a per-level `ClueSystem`. If `startHidden`, spawns invisible and registers a `RevealTarget` under `targetId` — same reveal convention as a hidden `Ball`. A hidden token can't be picked up until revealed, even if Lexi's standing on its buried spot. |
| `Crow` | point | — | `creatures/Crow.ts`, flees on bark. |
| `Owl` | point | — | `creatures/Owl.ts`. Perches until Lexi enters an `OpenGroundZone` while it's perched, then swoops at her; catching her is a `checkpointSystem.fail()`. |
| `OpenGroundZone` | rect | — | Not an entity — a plain rectangle any perched `Owl` in the map checks Lexi's position against each frame. Multiple zones and multiple owls are both fine (any perched owl triggers if Lexi's in any zone). |
| `WaterZone` | rect | `currentVx` (number) | `props/WaterZone.ts`. Whenever a map has at least one `WaterZone`, the loader automatically fails Lexi (`checkpointSystem.fail()`) if she's been swimming continuously for more than 3.5s, and crossfades the ambient bed to `"river"` while she's in any zone. |
| `WindZone` | rect | `gustForceX`, `intervalMs`, `telegraphMs`, `gustDurationMs` (numbers, all optional with defaults) | `props/WindZone.ts`. |
| `CheckpointZone` | rect | `checkpointId` (string, falls back to `<mapKey>_<objectId>`) | A `TriggerZone` wired to `checkpointSystem.checkpoint()`, which also calls `saveSystem.setCheckpoint(chapter, checkpointId)` — `chapter` comes from the map's own `chapter` property (see below), defaulting to the map key if unset. |
| `FailZone` | rect | — | A `TriggerZone` wired to `checkpointSystem.fail()`. |
| `MapExit` | rect | `nextMap` (string, required) | A `TriggerZone` that restarts the scene into the next map (`scene.scene.restart({ map: nextMap })`) — this is how a multi-map chapter chains together. Missing/empty `nextMap` logs a warning and does nothing (fail loud, don't silently strand the player). |
| `Decoration` | point | `variant` (`"tree"`\|`"rock"`\|`"fencePost"`\|`"bush"`, falls back to `"tree"`), `scale` (number, default 1) | `props/Decoration.ts`. Pure background dressing — no physics body, no per-frame update, nothing reads it back. Its base sits at the object's own `y`; place it at whatever ground-row's surface height it should stand on. |

Every level also gets a `SaveSystem`, `AudioSystem` (default `"forest"` bed, bark wired to
Lexi's `bark` event), a `ClueSystem` (registers every spawned `MemoryToken`, applies the
persisted token-count buff to `ScentSystem` on load), a 3-layer `FogLayers`, and a 5-layer
`ParallaxLayers` (PROMPTS P4.3 — see below) automatically — no object needed to opt in.

### Per-map atmosphere (`fx/Palette.ts`)

Not a Tiled property — a plain lookup table in `fx/Palette.ts`, keyed by `mapKey`, read once
per level. Each entry sets the camera's background color, an `ambientDarkness` overlay alpha
(a screen-fixed rectangle at depth 45 — above gameplay, below the fog bands, so fog still
reads as glowing faintly through the darkened scene), and a `fogDensity` multiplier on
`FogLayers`' base per-layer alpha. Add an entry when a new map needs a deliberately different
mood; unlisted maps fall back to a sensible default. Keep `ambientDarkness` low (≲0.15) —
`fx/Grain.ts`'s shader vignette already darkens the frame edges on every map, and stacking a
second darkening layer on top of that plus the fog bands crushes the tileset/decoration
detail underneath it fast (confirmed by screenshotting the actual renderer output, not just
tuning the numbers blind).

### Map-level properties

Set on the **map itself** in Tiled (not an object) — same `{name, type, value}` shape, read
once per level:

| Property | Type | Used for |
|---|---|---|
| `chapter` | string | `SaveSystem.setCheckpoint(chapter, checkpointId)`'s first argument. Defaults to the map's own key if unset, so single test maps (like `ch1_senses`) don't need it. |

Not yet supported by the loader: `Seesaw`, `Pulley`/`Counterweight`, `GuardDog`, `StrayDog`,
`Branch`. Add a `case` to `LevelLoader.ts`'s object-type switch when a real chapter first
needs one — the pattern is consistent for all of them (read `properties`, construct, push
into the right array).

## Puzzle wiring (`targets`)

Triggers (`Lever`, `PressurePlate`, `DigSpot`) carry a `targets` property: a comma-separated
list of target-id strings, e.g. `gate_01,gate_02`. Targets (`Gate`, and any `Ball`/`Crate`
registered via `RevealTarget`) carry a matching `targetId`. Wiring is by string match only —
a trigger and its target(s) don't need to be near each other or even on the same layer. This
is the same `PuzzleRegistry` P2.1's hand-built test rooms already use, so a level author
picks the id scheme (`lever_01`, `gate_01`, ...) — the loader doesn't enforce one.

## Scent trails

Draw a **Polyline** object anywhere in the map (any layer, any name) with **Type** set to
`ScentPath`. Its points become a `ScentSystem` path in order, first point first. Multiple
`ScentPath` objects are all loaded — one per distinct trail.

## Adding a new object type

1. Add a `case "YourType":` branch in `LevelLoader.ts`'s object-loop switch.
2. Read whatever `properties` the prop's constructor needs (`propsOf(obj)` returns a plain
   `{name: value}` lookup; `targetList()` / `num()` are small existing helpers for the common
   comma-list and numeric-with-default cases).
3. Push the instance into whichever array the room's `update()` loop already iterates
   (`grabCandidates`, `soundReactive`, `digSpots`, `waterZones`, `windZones`,
   `pressurePlates`, `triggerZones`) — or add a new array + iterate it in the returned
   `update()` if the type needs its own per-frame call.
4. Document the new type's properties in the table above.

## Chaining maps into a chapter

A `MapExit` at the end of one map and a `PlayerSpawn` near the start of the next is the whole
mechanism — there's no separate "chapter" concept in code, just a sequence of maps that name
each other. Give every map in the same chapter the same `chapter` map-level property so their
`CheckpointZone`s all write to the same `SaveSystem` progress key. The last map in a chapter
simply has no `MapExit`.

## Reference maps

- `public/levels/ch1_senses.tmj` rebuilds the P1.3/P2.3 "Senses" test room (key `6`) as a
  single Tiled map: a crow to bark off, a scent trail leading to a buried ball, and a fence
  you dig under — exercising tile collision, point/rect object spawning, `targets`-based
  puzzle wiring (both digspots), and a polyline scent path, purely as data. Not chained to
  anything (no `chapter` property, no `MapExit`) — it's a standalone loader smoke test, not
  part of Chapter 1.
- `public/levels/ch1_01_reststop.tmj` through `ch1_05_highway.tmj` are Chapter 1's five-map
  blockout (PROMPTS P4.1), chained start to finish via `MapExit`/`PlayerSpawn`: a safe
  move/jump intro, a crate-drag-and-boost teaching GRAB, a stream crossing on floating logs
  (the first real hazard), owl territory (a safe crow first, then the swoop hazard), and the
  highway fence (scent trail to a buried token, then dig under to finish). Three optional
  Memory Tokens (a ball, a chewed stick, a car air-freshener) are reachable off the direct
  path — none are required to reach the next map.
