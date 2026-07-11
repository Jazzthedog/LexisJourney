# Lexi's Journey — Build Prompts

A sequenced set of prompts to drive AI-assisted development of the game described in `SPEC.md`.
Run them in order; each assumes the previous ones are done. Every prompt ends with a **verify**
step — don't move on until it passes. Reference `SPEC.md` in every session so context carries.

---

## Phase 0 — Foundation

### P0.1 — Project skeleton
> Read SPEC.md. Scaffold the project: Vite + TypeScript + Phaser 3. Create the folder structure
> from SPEC §5 (scenes/, entities/, systems/, levels/, fx/). Set up `main.ts` with a Phaser config
> (1280×720, scale to fit, pixelArt off, Arcade Physics with gravity ~1000), and a BootScene that
> shows a loading bar then starts an empty GameScene rendering a dark grey background.
> Set up the deploy path now — `npm run build` → itch.io HTML5 upload or GitHub Pages — so every
> later milestone is one command from a shareable URL (M0's definition of done includes deploy).
> **Verify:** `npm run dev` opens a page showing the empty scene with no console errors, and the
> built version loads from the public URL.

### P0.2 — The look, before anything else
> Add the monochrome post-processing layer: film grain shader (`fx/Grain.ts`), vignette, and 3
> parallax fog layers (`fx/Fog.ts`) drifting slowly. Add a debug key (G) to toggle grain. Place
> placeholder silhouette rectangles at different parallax depths to prove the depth look.
> **Verify:** screenshot should already feel "Limbo-ish" — dark, grainy, layered fog — with zero
> gameplay. If the empty screen doesn't set a mood, fix this before adding a single mechanic.

### P0.3 — Debug harness
> Add a debug overlay (toggle: backtick) showing FPS, Lexi's current state, and physics body
> outlines. Debug keys: R = restart at checkpoint, 1–9 = jump straight to a test room/map,
> F = free-fly camera. Gate everything behind a `DEBUG` flag stripped from production builds.
> Every phase after this one lives inside test rooms — cheap teleportation pays for itself daily.
> **Verify:** you can hop between two test rooms and inspect hitboxes without reloading the page.

---

## Phase 1 — Lexi (game-feel first)

### P1.1 — Movement core
> Create `entities/Lexi.ts` as a state machine (IDLE, RUN, JUMP, FALL, LAND). Placeholder art: a
> black capsule with two white dot eyes and a small red collar rectangle. Implement: run with
> acceleration/deceleration (not instant), variable-height jump (hold = higher, release = cut),
> coyote time (~100ms), jump buffering (~120ms), landing squash. Camera: smooth-follow with
> look-ahead in the facing direction. Route all input through a small `InputMap` abstraction and
> support keyboard **and gamepad** from day one — retrofitting pad support later is painful;
> touch waits until P5.1. Physics is Arcade-only per SPEC §5's physics note — tune the feel in
> the engine that ships.
> **Verify:** playable test room of platforms. Iterate on the numbers until jumping around is
> *fun by itself*. This prompt is done when movement feels good, not when it compiles.

### P1.2 — Grab / bite / drag
> Add GRAB state: near a grabbable object, hold E to bite. While biting: drag crates (movement
> slows by weight), pull rope ends, carry small items in mouth (one-slot mouth inventory —
> picking up a new item drops the current one). Add `props/Crate.ts` and a carryable Ball prop.
> **Verify:** in the test room, drag a crate to reach a high ledge; carry the ball across a gap.

### P1.3 — Bark, sniff, dig
> Add BARK (Q): plays animation, emits an invisible expanding circle that notifies
> `SoundReactive` objects in radius. Add SNIFF (hold Shift): world darkens further, scent wisps
> render (`systems/ScentSystem.ts` — particle trail along spline paths defined in level data);
> movement slows while sniffing. Add DIG (S on DigSpot zones): short animation, reveals buried
> item or opens passage under a fence.
> **Verify:** test room with a crow that flies off when barked at, a scent trail leading to a
> buried ball, a fence with a dig spot under it.

---

## Phase 2 — Puzzle bricks

### P2.1 — Mechanical props
> Build the composable puzzle set, each as its own class in `entities/props/`, each demoed in its
> own test room: Lever (bite + pull, toggles a target), Gate (opens/closes, can be a target),
> Rope/Pulley with counterweight, Seesaw plank on pivot, PressurePlate (Lexi's weight or a crate).
> Per SPEC §5's physics note these are **scripted kinematic props, not simulated bodies** — the
> seesaw lerps rotation from weight distribution, the pulley is a scripted constraint. Do NOT
> introduce Matter.js here; if a prop feels dead when scripted, flag it and decide once.
> Wire targets via string IDs so Tiled data can connect them later (`lever_01 → gate_01`).
> **Verify:** a combo room — plate holds gate open only while weighted; solve by dragging a crate
> onto it.

### P2.2 — Water and wind
> Add `WaterZone` (Lexi swims slowly on the surface, is swept by current vectors; submersion
> beyond N seconds = fail → checkpoint) and `WindZone` (periodic gust force with a visible cue:
> fog streaks + leaf particles + audio swell 0.5s before the gust; gusts alter jump arcs).
> Add `CheckpointSystem` now: checkpoint zones snapshot Lexi + prop positions; fail fades to
> black and restores in <1s.
> **Verify:** cross a river on floating logs against a current; make a wind-timed jump. Fail
> both on purpose and confirm instant, painless respawn.

### P2.3 — Creatures
> Add creatures with tiny state machines: Crow (perches, flees from bark — its branch is a
> physics platform that rises when they leave), Owl (swoops when Lexi crosses open ground; forces
> cover-to-cover movement), GuardDog (chained — lunges to chain limit; the safe arc is the
> puzzle), StrayDog ally (per SPEC §2: moves between *authored station points* on bark command —
> sits on plates / holds levers — no free-follow pathfinding; keep it a switch you aim with a
> bark, not a companion AI).
> **Verify:** one test room per creature; the guard-dog room solvable only by baiting the lunge.

---

## Phase 3 — Content pipeline

### P3.1 — Tiled integration
> Install Tiled workflow: `levels/LevelLoader.ts` parses `.tmj` maps — tile layers for collision
> and silhouette visuals, object layers for entity spawns (type + properties = class + config),
> scent splines as polylines, checkpoint/water/wind zones as rectangles, puzzle wiring via
> `targets` properties. GameScene becomes fully data-driven: `GameScene.start({ map: 'ch1_01' })`.
> Document the authoring conventions in `levels/README.md`.
> **Verify:** rebuild one existing test room purely as a Tiled map with zero new code.

### P3.2 — Clues & narrative system
> `systems/ClueSystem.ts`: MemoryToken props (rendered with the red accent tint + soft pulse).
> On pickup: gameplay pauses, a memory-echo vignette plays (ghostly silhouette tableau — a
> static composed image with fog + grain and the whistle motif, 4s), then fades back. Track
> collected tokens in `SaveSystem` (localStorage: chapter, checkpoint, tokens). Per SPEC §2,
> each collected token permanently buffs `ScentSystem` (wisp brightness, range, and linger
> duration scale with token count) — the buff must persist through save/reload.
> **Verify:** collect a token, reload the page, token stays collected, progress restores, and
> scent wisps are visibly stronger than with zero tokens.

### P3.3 — Audio bed
> `systems/AudioSystem.ts`: looping ambient beds per level with crossfade on transitions,
> positional one-shots (creak, splash, chain rattle), surface-aware paw steps (grass/wood/metal),
> bark, and the 4-note whistle motif. Source CC0 sounds (freesound.org) into `public/audio/`,
> list attributions in `CREDITS.md` even for CC0.
> **Verify:** walking across three surfaces sounds distinct; closing your eyes in the river room
> still tells you where the water is.

---

## Phase 4 — Chapter 1: The Forest

### P4.1 — Blockout
> Design Chapter 1 as 5 Tiled maps (SPEC §2): rest-stop intro → deep woods (grab/crate
> teaching) → stream crossing (water) → owl territory (bark + cover) → highway fence (dig,
> chapter end). Greybox only: placeholder tiles, all puzzles functional, checkpoints every
> puzzle, 3 memory tokens hidden off the critical path (ball, chewed stick, car air-freshener).
> Teaching order matters: each verb gets a safe intro room before it appears in a hazard.
> **Verify:** full chapter playable start-to-finish in 10–15 min without touching code.

### P4.2 — Intro cutscene
> Wordless 30-second intro as an in-engine scripted sequence (SPEC §2 premise): car, ball,
> chase, truck passes, car departs. Silhouettes + sound only. Skippable after first view.
> **Verify:** a first-time viewer understands the premise with zero words.

### P4.3 — Art pass
> Replace Chapter 1 greybox: silhouette tree/rock/fence tilesets, 5 parallax background layers,
> per-map fog density and ambient-light values (`fx/Palette.ts`), Lexi's real silhouette sprite
> set (run cycle with ear/tail follow-through, tail = emotion: up curious, low scared, wag on
> token pickup).
> **Verify:** any random screenshot of Chapter 1 passes the "could be mistaken for a Limbo
> screenshot (plus one red accent)" test.

---

## Phase 5 — Ship the slice, then the rest

### P5.1 — Menu, options, deploy
> MenuScene: title over slow fog, Continue/New/Chapters(locked)/Options (volume sliders, grain
> toggle, high-contrast mode). Add an in-game pause menu (Esc/Start: resume, restart checkpoint,
> options, quit to menu). `npm run build` → deploy to itch.io (HTML5 project) and/or GitHub
> Pages. Add touch controls (left zone = move, swipe up = jump, buttons for bark/sniff) behind
> mobile detection.
> **Verify:** a friend plays Chapter 1 on a URL, on desktop and phone, with no instructions —
> and it holds a stable framerate on a mid-range phone (grain/fog auto-degrade if not).

### GATE — vertical-slice review (do not skip)
> Before starting P5.2, stop and evaluate (SPEC §6 gate): What did playtesters actually do?
> Where did they quit, get lost, or smile? Is Chapter 1 fun *without* being told the premise?
> Decide here whether v1 stays five chapters or re-scopes to three (ending on the Ch. 3 LOST DOG
> poster beat). Chapters are independent map files precisely so this decision is cheap now and
> expensive later.
> **Verify:** a written go/no-go note with scope decision committed to the repo (`DECISIONS.md`).

### P5.2–P5.5 — Chapters 2–5
> One prompt per chapter, same pattern as Phase 4 (blockout → verify → art pass → verify).
> New bricks per chapter, kept to 1–2 each: Ch2 rain + river currents + debris rafts;
> Ch3 magnets/conveyors/crusher timing + stray-ally commands; Ch4 verticality + human-hazard
> stealth + shelter escape; Ch5 dawn palette ramp + combined-verb finale + ending scene (the
> single warm-lit frame).
> **Verify each:** chapter playable end-to-end; cut anything that isn't working — Playdead
> trashed 70%, we can trash a room.

### P5.6 — Steam wrap (when ready)
> Wrap the web build with Tauri for Windows/Mac/Linux. Integrate Steamworks (achievements: one
> per chapter + all-tokens; cloud save = sync the localStorage blob). Store page assets: capsule
> art, 6 screenshots, 60s trailer cut from in-game footage.
> **Verify:** clean install runs on a machine that never had the dev environment.

---

## Working rules (apply to every prompt)

1. **Feel before features** — movement tuning and mood outrank new mechanics.
2. **One system per session** — keep sessions scoped to one prompt; commit after each verify.
3. **Data over code** — if a level needs new code for a one-off, consider making it a reusable
   brick or cutting it.
4. **The screenshot test** — every art-pass verify is "does a random frame look like the game we
   pitched?"
5. **Trash freely** — chapters are independent map files precisely so cutting is cheap.
