# Lexi's Journey — Game Specification

A 2D atmospheric puzzle-platformer in the spirit of **Limbo**, starring **Lexi**, a dog who got
lost and is finding her way home to her owners.

---

## 1. High Concept

> *Separated from her family during a roadside stop, a dog named Lexi crosses forests, storms,
> junkyards, and city streets — following faint scents and scattered clues — to find her way home.*

- **Genre:** 2D side-scrolling puzzle-platformer ("cinematic platformer")
- **Tone:** Melancholy but hopeful. Dark, moody silhouette world — but unlike Limbo, the journey
  bends toward warmth. No gore; danger is real but failure is a *setback*, never gruesome.
- **Length target (v1):** 45–90 minutes, 5 chapters
- **Audience:** Everyone. Limbo fans, casual players, dog lovers. No text/dialogue needed to play.

### What we take from Limbo
| Limbo | Lexi's Journey |
|---|---|
| Two verbs: jump + grab | Three verbs: **jump**, **grab (bite/drag)**, **bark** — plus contextual **dig** and **sniff** |
| Trial-and-death puzzle design | Trial-and-*setback*: fail states knock Lexi back, scare her off, or trap her — instant checkpoint restart, no penalty |
| Boy seeks his sister; zero exposition | Lexi seeks her owners; story told entirely through environment + clues |
| Monochrome silhouettes, film grain, fog | Same monochrome silhouette style, **plus one accent color: the red of Lexi's collar/leash and every clue tied to her family** |
| Acousmatic ambient sound, no melody until key moments | Ambient soundscape; a simple 4-note "family whistle" motif that recurs and resolves at the ending |

### The one signature twist — Scent Vision
Hold a button to enter **Sniff Mode**: the world desaturates further and faint glowing wisps
reveal scent trails, buried objects, and "memory echoes" (ghostly silhouette vignettes of the
family, 3–5 seconds, no words). Scent is the *navigation and narrative* system — it is how a dog
experiences the world, and it justifies wordless storytelling.

---

## 2. Story & Structure

### Premise (told in a 30-second wordless intro)
A car pulls over at a forest rest stop. A ball bounces out. Lexi chases it. A truck passes,
a gate swings shut, the car — unaware — pulls away. Lexi is alone. Her red leash trails behind her.

### Five Chapters

**Ch. 1 — The Forest (tutorial)**
Dusk woods near the rest stop. Learn move/jump/grab/bark/sniff. Hazards: streams, log crossings,
a territorial owl, deadfall traps. **Clue:** the tennis ball (red-tinted) that started it all;
scent trail of the family car leading to the highway.

**Ch. 2 — The Storm & The River**
Night. Rain, wind gusts that alter jump physics, rising water, floating-debris platforming.
Lexi is swept downriver — the trail is lost. **Clue:** the daughter's red scarf snagged on a
branch; carrying it restores a faint scent trail.

**Ch. 3 — The Junkyard & The Strays**
Industrial outskirts. Machinery physics: magnets, conveyors, car-crusher timing puzzles.
A pack of stray dogs — first hostile (stealth/avoidance), later one becomes a temporary ally
(cooperative puzzles: it holds a lever while Lexi crosses; they part ways at the fence).
**Clue:** a rain-soaked **LOST DOG poster with Lexi's own face** — her family is searching too.
This is the emotional midpoint: the search goes both ways.

**Ch. 4 — The Town**
Rainy small town at night. Verticality: fire escapes, awnings, rooftops. Human hazards to avoid
(animal control van, a slamming door, crowds). A near-miss: Lexi sees the family car drive past
and cannot catch it. Optional shelter sequence: caged, must escape (pure puzzle, no cruelty).
**Clue:** the family's flyer trail leads to their neighborhood; the whistle motif is heard for
the first time, far away.

**Ch. 5 — Home Stretch**
Dawn breaks — the palette lightens chapter-long from near-black to soft grey. Familiar suburb.
Final puzzles use *everything learned*. The whistle grows louder. Last scene: the backyard gate,
the ball, the family turning around — the only fully-lit, warm-toned frame in the game. Cut to
title. (Ambiguity is Limbo's move; ours is earned warmth — the payoff of a hopeful tone.)

### Clue system (collectible + narrative)
Every chapter hides 2–3 **Memory Tokens** (red-tinted family objects: ball, scarf, poster,
bandana, photo). Finding one triggers a short memory-echo vignette. Collecting all unlocks a
brief post-credits scene (Lexi asleep by the fire). Clues are optional — the critical path never
requires all of them.

---

## 3. Gameplay Detail

### Controls (keyboard / gamepad / touch overlay)
| Action | Key | Pad | Notes |
|---|---|---|---|
| Move | ←/→ or A/D | Left stick | Walk; hold to run |
| Jump | Space / W / ↑ | A | Variable height (hold = higher) |
| Grab / Bite | E or hold ↓+dir | X (hold) | Drag crates, pull levers/ropes, carry items in mouth |
| Bark | Q | B | Scares birds/critters, triggers sound-reactive objects, calls ally |
| Sniff Mode | Hold Shift | Hold LT | Reveals scent wisps, buried spots, memory echoes |
| Dig | S at dig spots | ↓ | Contextual: under fences, buried clues |

### Puzzle vocabulary (mix & escalate, Limbo-style)
1. **Physics:** push/drag crates, seesaws, ropes and pulleys (bite the rope), floating logs, counterweights.
2. **Sound:** bark to startle crows off a branch (branch rises = platform), set off a car alarm to
   distract animal control, echo-activated machinery.
3. **Scent:** invisible-path navigation in fog/dark, find the buried key, choose the correct door.
4. **Dog-logic:** squeeze through gaps humans can't, dig under obstacles, carry one item at a time
   in mouth (inventory = mouth: elegant one-slot constraint that *creates* puzzles).
5. **Creature interactions:** owl, crows, river fish, stray pack, junkyard guard dog on a chain
   (arc-of-the-chain spatial puzzle, an homage to Limbo's spider pacing).
6. **Weather physics (Ch.2+):** wind gusts modify jump arcs on a visible rhythm, rising/falling water.

### Fail & checkpoint design
- Fail states: swept away by water, caught by animal control, snapped-at by the guard dog,
  crushed *off-screen implied* by machinery (screen cuts to black — the "gore filter" is our default).
- Instant respawn at generous checkpoints (every puzzle). Zero penalty, Limbo-style: failure *is*
  the hint system.
- No lives, no score, no timers except within individual puzzle beats.

---

## 4. Art & Audio Direction

- **Palette:** true monochrome silhouettes + fog layers + film grain + subtle vignette. Exactly
  one accent hue (desaturated red) reserved for Lexi's collar and family clues — instantly reads
  as "this matters."
- **Layers:** 4–6 parallax depths; foreground silhouettes occasionally occlude the play layer
  (Limbo's misdirection trick).
- **Lexi:** pure black silhouette with two small bright eyes (like Limbo's boy) + red collar.
  Readable animal silhouette: pointed ears, tail as an emotion channel (tail animation = the
  entire facial-expression budget).
- **Animation:** squash-and-stretch runs, ear/tail physics; deaths/fails always tasteful.
- **Lighting:** as the game progresses, ambient light rises chapter by chapter (despair → hope
  encoded in the palette itself).
- **Audio:** granular ambient beds (wind, rain, machinery, distant traffic), no music except the
  4-note whistle motif; Lexi foley (paw taps differ per surface, panting, one bark sample-set).

---

## 5. Technology & Architecture

### Decision: **Web-first with Phaser 3 + TypeScript** (no Unity, no custom engine)

Playdead's lesson was explicit: building a custom engine was a "double product." We go the
opposite way — the most boring, proven 2D web stack:

| Layer | Choice | Why |
|---|---|---|
| Engine | **Phaser 3** (Arcade Physics; Matter.js only if rope/seesaw puzzles need it) | Mature, huge docs, purpose-built for 2D browser games |
| Language | **TypeScript** | Safety for a growing codebase; excellent AI-assisted iteration |
| Build | **Vite** | Instant dev server, trivial static builds |
| Levels | **Tiled** map editor (`.tmj` JSON) | Free visual editor; Phaser loads it natively |
| Art pipeline | SVG/PNG silhouettes + texture atlases (free: Krita/Inkscape; TexturePacker optional) | Monochrome = tiny asset budget |
| Audio | Web Audio via Phaser sound manager; **Audacity** + freesound.org (CC0) for beds | |
| Save | `localStorage` (chapter + checkpoint + tokens) | No backend needed |
| Deploy (web) | Static hosting: **itch.io**, GitHub Pages, or Netlify | Zero infrastructure |
| Desktop/Steam later | **Tauri** (preferred: ~10 MB) or Electron wrapper + Steamworks | A packaging step, not a rewrite |

**Alternative considered — Godot 4:** excellent, free, 2D-first, one-click exports to
Windows/Mac/Linux/Web. Choose it instead **if** you decide Steam-native is the primary target or
you want a visual scene editor. Trade-offs: web export is heavier (~30 MB+ wasm), and iteration
here is code-file-centric which favors Phaser. Not chosen for v1, but the game design ports 1:1.

**Rejected:** Unity (user constraint, overkill), custom engine (Playdead's own regret),
GameMaker (licensing), LÖVE (no easy web export path).

### Distribution answer: Steam vs. Web?
**Both — in this order.** Ship as a **web app first**: zero-friction playtesting (send a URL),
itch.io page for community, no store fees or review gates while iterating. When content and
polish justify it, wrap the same build with Tauri and ship to **Steam** ($100 fee, Steamworks SDK
for achievements/cloud saves). Limbo itself was a downloadable title, but Limbo also had a
finished studio behind it — for a solo/AI-assisted project, web-first buys the fastest feedback
loop, which is the thing that actually made Limbo good (2.5 years of iteration, 70% thrown away).

### Code architecture

```
src/
  main.ts                 // Phaser game config, scene registration
  scenes/
    BootScene.ts          // asset loading, loading bar
    MenuScene.ts          // title, chapter select, options (grain/contrast toggle)
    GameScene.ts          // generic level runner — data-driven, one scene for ALL levels
    UIScene.ts            // overlay: sniff-mode vignette, fade transitions, token popups
  entities/
    Lexi.ts               // player controller (state machine: idle/run/jump/grab/bark/sniff/dig)
    creatures/            // Owl.ts, Crow.ts, StrayDog.ts, GuardDog.ts ...
    props/                // Crate.ts, Rope.ts, Lever.ts, Seesaw.ts, WaterZone.ts, WindZone.ts ...
  systems/
    ScentSystem.ts        // wisp particle paths, sniff-mode rendering
    CheckpointSystem.ts   // respawn state snapshots
    ClueSystem.ts         // memory tokens, echo vignettes
    AudioSystem.ts        // ambient beds, positional oneshots, whistle motif
    SaveSystem.ts         // localStorage progress
  levels/
    chapter1/*.tmj        // Tiled maps; object layers carry puzzle wiring
    LevelLoader.ts        // parses Tiled object properties -> entity spawns + puzzle links
  fx/
    Grain.ts              // film grain post-fx pipeline
    Fog.ts                // parallax fog layers
    Palette.ts            // per-chapter ambient light ramp
```

**Key principles**
- **Data-driven levels:** one `GameScene` reads any Tiled map; puzzles are wired via object
  properties (`lever_01 targets gate_01`). New content = new map file, not new code.
- **Entity state machines,** not sprawling `update()` ifs.
- **Puzzle elements are composable LEGO bricks** — the roster in §3 is built once, then levels
  recombine them (this is exactly how Limbo gets depth from two verbs).
- **Fixed-timestep physics** (Arcade default) for deterministic puzzle behavior.
- **Post-fx isolated** in `fx/` so the monochrome look is a layer, not baked into assets.

---

## 6. Milestones

| # | Milestone | Definition of done |
|---|---|---|
| M0 | Project skeleton | Vite+Phaser+TS boots, black screen with grain fx, deployed to itch/Pages |
| M1 | Lexi moves | Run/jump/grab on placeholder geometry; feels *good* (this milestone is 80% game-feel tuning) |
| M2 | Puzzle bricks | Crate, lever, rope, seesaw, water, wind, dig spot — each in a test room |
| M3 | Sniff & bark | Scent wisps, memory echo vignette, sound-reactive objects |
| M4 | Chapter 1 playable | Full forest chapter, checkpoints, save, 3 tokens, intro cutscene |
| M5 | Vertical-slice polish | Audio beds, parallax fog, grain, tail animation — "screenshot = Limbo test" |
| M6–M9 | Chapters 2–5 | One milestone each, reusing bricks + 1–2 new mechanics per chapter |
| M10 | Release pass | Options, gamepad+touch, itch.io launch; then Tauri/Steam wrap |

**Rule inherited from Playdead:** be willing to trash content that doesn't fit. Build chapters as
independent map files so cutting/reordering is cheap.
