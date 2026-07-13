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
`public/tilesets/ground.png`. This is a deliberate placeholder-art-era convention, not a
structural limit — the tile-collision code itself doesn't care what the tileset looks like.
Swap in real per-chapter tilesets once P4.3's art pass lands; until then, every map should
just reference the `ground` tileset with `firstgid: 1`.

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
| `Crow` | point | — | `creatures/Crow.ts`, flees on bark. |
| `WaterZone` | rect | `currentVx` (number) | `props/WaterZone.ts`. |
| `WindZone` | rect | `gustForceX`, `intervalMs`, `telegraphMs`, `gustDurationMs` (numbers, all optional with defaults) | `props/WindZone.ts`. |
| `CheckpointZone` | rect | — | A `TriggerZone` wired to `checkpointSystem.checkpoint()`. |
| `FailZone` | rect | — | A `TriggerZone` wired to `checkpointSystem.fail()`. |

Not yet supported by the loader (still test-room-only as of P3.1): `Seesaw`, `Pulley`/
`Counterweight`, `FloatingLog`, `Owl`, `GuardDog`, `StrayDog`, `Branch`. Add a `case` to
`LevelLoader.ts`'s object-type switch when a real chapter first needs one — the pattern is
consistent for all of them (read `properties`, construct, push into the right array).

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

## Reference map

`public/levels/ch1_senses.tmj` rebuilds the P1.3/P2.3 "Senses" test room (key `6`) as a Tiled
map: a crow to bark off, a scent trail leading to a buried ball, and a fence you dig under —
exercising tile collision, point/rect object spawning, `targets`-based puzzle wiring (both
digspots), and a polyline scent path, purely as data.
