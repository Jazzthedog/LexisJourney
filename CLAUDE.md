# Lexi's Journey — Agent Notes

`SPEC.md` (design) and `PROMPTS.md` (build queue) are authoritative — read both in full
before touching code. Session handoffs live in `.claude/handoffs/`.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — typecheck (`tsc -b`) + production build to `dist/`
- `npm run preview` — serve `dist/` statically, the same way itch.io/GitHub Pages would

## Gotchas

### Phaser's game loop can silently stall in an automated/backgrounded browser tab

`document.visibilityState` can stay `"hidden"` for a tab driven by browser automation
(observed with claude-in-chrome), and Chrome fully **suspends** `requestAnimationFrame`
for hidden tabs — not throttles, suspends. Phaser's `SceneManager` processes queued
operations (like a `scene.start()` transition) inside its own update step, which is
driven by that same rAF loop. Symptom: the game boots, `BootScene` runs, but it never
reaches `GameScene` — everything looks frozen on a blank/loading screen with **zero
console errors**, because nothing actually threw.

Fixed in `main.ts` via `fps: { forceSetTimeOut: true }`, which makes Phaser tick off
`setTimeout` instead of `rAF`. `setTimeout` isn't subject to the same hidden-tab
suspension, so the loop keeps running regardless of tab focus. Don't remove this — it's
also correct for a real player (a backgrounded browser tab shouldn't freeze the game).

If a future verify step looks stuck with no errors, check `document.visibilityState` and
confirm this config is still in place before assuming the feature code is broken.

### Windows: killing a background dev server by its bash job PID often doesn't work

Under Git Bash on Windows, a job started with `command &` gets a bash-assigned PID that
doesn't always map to the real `node.exe`/`esbuild` process — `kill <that-pid>` can
report success while the process (and the port) stays alive. Instead:

```bash
netstat -ano | grep -E ":(5173|4173)" | grep LISTENING   # find the real PID on the port
taskkill //PID <pid> //F                                  // (Bash tool: use taskkill via cmd)
```

Check for stale `vite`/`node` processes left over from a prior session before starting a
new dev server — a stale process holding the port causes Vite to silently pick a
different port, which then desyncs from whatever URL you verify against.

### Verifying gameplay: `game.loop.step()` + real `dispatchEvent` keyboard input works, but two things will burn you

Because rAF is suspended in this environment (see above), the reliable way to verify
physics/movement precisely is: expose `window.__game = game` temporarily in `main.ts`
(remove before committing), then drive frames deterministically —

```js
let t = performance.now();
function step(n) { for (let i = 0; i < n; i++) { t += 16.67; game.loop.step(t); } }
window.dispatchEvent(new KeyboardEvent('keydown', { keyCode, which: keyCode, code, key, bubbles: true }));
```

`keyCode`/`which` must be set explicitly — a synthetic `KeyboardEvent` doesn't populate
them by default, and Phaser's `Key` objects match on `keyCode`, so an event without it is
silently ignored (no error, the key just never registers as pressed).

Two failure modes this pattern produces, neither of which is a real product bug:

1. **A real `wait()` between dispatches can drop "held" keys.** Chrome fires a window
   `blur` during `wait()` in this environment, and Phaser's `KeyboardManager` resets all
   key state on blur (correct behavior for a real player alt-tabbing — prevents stuck
   keys). A test that dispatches `keydown` then calls `wait()` before checking will find
   the key silently released. Keep held-key sequences inside continuous manual
   `step()` calls, not spread across `wait()`.
2. **Tween completion doesn't track a manually stepped clock.** `scene.tweens` timing
   desyncs from `game.loop.step(t)` — a tween (e.g. Lexi's landing squash) can look
   permanently frozen at `progress: 0` under manual stepping for dozens of simulated
   frames, then complete instantly once given genuine real-time ticking. If a
   tween-driven state transition looks stuck, verify with a real `wait()`, not more
   `step()` calls, before concluding it's broken.

Physics state (position/velocity/`body.blocked`) *does* track `step(t)` accurately —
these two quirks are specific to keyboard-state-across-wait and Tween timing.

3. **`scene.scene.restart()` doesn't take effect until a frame actually ticks.** It's
   deferred to the SceneManager's next update, not synchronous. Reading `scene.lexi` (or
   any other room state) immediately after calling `restart()` returns the **old** scene's
   objects with no error — it just silently looks like nothing moved/reset. Always call
   `step()` at least once (P2.1/P2.2 sessions used ~20 frames to be safe) before reading
   anything from a scene you just restarted. `scene.scene.start("OtherKey")` (P4.2's
   `IntroScene` → `GameScene` handoff) has the identical one-frame lag — checking
   `game.scene.getScenes(true)` right after calling `start()` still lists the *old* scene
   key; step a batch of frames before asserting on which scene is active.

### A velocity mutation applied before `Lexi.updateHorizontal()` gets silently erased

Any per-frame environmental push on Lexi's horizontal velocity (river current in P2.2's
`WaterZone`, gust force in `WindZone`) **must** be folded into `updateHorizontal()`'s own
`targetSpeed` calculation, not applied as a separate `body.velocity.x +=` elsewhere in
`update()`. `updateHorizontal()` recomputes `velocity.x` from scratch via `moveTowards`
toward a fixed input-driven target every single frame — an addition made *before* it runs
gets overwritten outright, and an addition made *after* it runs gets erased on the very
next frame anyway, because `moveTowards` snaps fully to target the moment the gap is
smaller than one frame's max accel/decel step (which it almost always is for a small
per-frame nudge). This cost real debugging time in P2.2: the wind gust force was being set
correctly on the zone, read correctly by Lexi, and applied via `+=`, yet her measured
velocity never moved — because `updateHorizontal()` ran immediately afterward and stomped
it back to the input's target speed. The fix (and the only place either effect lasts) is
adding the offset into `targetSpeed` itself, exactly like the existing weight/sniff
multipliers, so `moveTowards` ramps toward the *combined* target.

### Arcade's `body.setMaxVelocity()` doesn't clamp a manually-assigned `velocity.x`

Lexi's `setMaxVelocity(MOVE_SPEED * 1.6, 1000)` from P1.1 does **not** hard-cap
`updateHorizontal()`'s direct `body.velocity.x = moveTowards(...)` assignment — in testing
(P2.2's wind gust), her actual velocity plateaued around 416-436px/s regardless of whether
the gust's target speed was 680 or 1160+. Don't chase a bigger force value expecting
proportionally more speed past that point; it doesn't happen. If a mechanic needs Lexi to
go faster than that ceiling, the lever is `setMaxVelocity` itself, not the pushing force.

### A pursuing creature that re-aims at Lexi's *live* position every frame is unbeatable if it's faster than her

P2.3's `GuardDog` originally recomputed its lunge target from Lexi's current position every
frame (continuous homing). Since its lunge speed (480px/s) exceeds her run speed
(260px/s), no amount of clever fleeing could ever create distance — the pursuer always
closes the gap, full stop, regardless of player skill. This isn't a tuning problem you can
fix with bigger numbers; it's structural. Two changes were both required to make
"solvable only by baiting the lunge" (PROMPTS P2.3) actually true:

1. **Commit to a fixed target once, at trigger time** (`lungeTargetX/Y` captured on the
   `IDLE -> COIL` transition), not re-aimed every frame. A lunge is a strike at where you
   *were*, not a heat-seeking missile — this alone makes evasion possible in principle.
2. **A brief telegraph before the strike actually moves** (`COIL` state, ~220ms). Without
   it, the reaction window between "trigger fires" and "bite lands" is too short for a
   slower player to meaningfully react even with a committed target, because reversing
   run direction itself costs several frames of decel-then-accel. This mirrors `Owl`'s
   `TELEGRAPH` state and `WindZone`'s 0.5s pre-gust cue — any future creature/hazard that's
   faster than Lexi needs a genuine warning beat before it commits, or the encounter is
   just a coin flip disguised as a puzzle.

Verified the fix numerically, not just "it compiles": a naive continuous walk through the
guard-dog corridor still gets caught every time (confirms it's not toothless), while
bait -> retreat until the dog is confirmed in `RECOVER` -> sprint through clears the
corridor cleanly every time (confirms it's actually solvable).

### Phaser Scene lifecycle: `preload()` receives no arguments, only `init(data)` and `create(data)` do

P3.1's `GameScene` needs to know the `map` key *inside* `preload()`, to queue
`load.tilemapTiledJSON`/`load.image` calls before `create()` runs. `scene.preload.call(scene)`
is invoked with zero arguments by `SceneManager.bootScene` — the scene-start data object only
ever reaches `init(data)` and `create(data)`. The fix: implement `init(data)` solely to stash
`this.pendingData = data`, then have `preload()` read `this.pendingData` (no params) instead
of expecting an argument. Getting this wrong doesn't throw — `data` would just be
`undefined` inside a `preload(data)` signature, silently skipping the map's asset loads.

### Tiled's `properties` array is NOT converted to a plain object by Phaser's loader

A Tiled object's custom properties are stored in the raw JSON as
`[{name, type, value}, ...]`. `Phaser.Tilemaps.Parsers.Tiled.ParseObject` copies this array
through **unchanged** (`Pick(tiledObject, [...,'properties',...])`) — `obj.properties` on a
loaded `Phaser.Types.Tilemaps.TiledObject` is still that array, not a `{name: value}` lookup.
`LevelLoader.ts`'s `propsOf()` helper does the array-to-object conversion; don't assume a
future Phaser version or a different loader path hands you an already-flattened object
without checking `ParseObject.js` again.

### "Pause gameplay" must call `scene.physics.pause()` — skipping your own update loop isn't enough

P3.2's memory-echo vignette needs to genuinely freeze the world while it plays. The first
attempt just made the room's own `update()` callback early-return while `clueSystem.isPaused`
— but Arcade Physics integrates gravity and existing velocity **every** step regardless of
whether anything calls `lexi.update()`. A token grabbed mid-run kept sliding under her last
velocity for the whole vignette, because skipping your own per-frame wrapper doesn't stop
Phaser's own automatic physics-world step, which runs independently. The fix:
`scene.physics.pause()` when the freeze starts, `scene.physics.resume()` when it ends —
`ClueSystem` owns this directly rather than trusting every room that uses it to get the
early-return right. Verified by holding a movement key through the entire pause and
confirming Lexi's x is bit-for-bit identical before and after (not just "close enough").

### Verifying timed sequences (vignettes, cooldowns): a step-loop's exit condition must track the *real* stop signal, not a proxy that stops changing once paused

Chased a false alarm here: a `for` loop stepping frames "until Lexi's x reaches N" kept
running its full iteration budget (silently burning ~3s of simulated time) because once
`physics.pause()` freezes her position, `x < N` stays true forever — the loop never learns
the walk is over. The fix was trivial (also break on the actual event, e.g.
`!token.isCollected`), but the symptom looked exactly like a real vignette-timing bug (a huge
first-frame `elapsedMs` jump) until re-run with the corrected loop condition showed the
timing was correct all along. When a step-loop's exit condition is a *position* rather than
the *event* you actually care about, and the code under test can freeze that position, the
loop stops being a reliable proxy — prefer breaking on the actual state change.

### Verifying Web Audio (P3.3): `AudioContext.currentTime` never advances without a real trusted user gesture, and neither synthetic keys nor automation-driven clicks count

`AudioSystem`'s `ctx` starts (and stays) `"suspended"` in this environment — confirmed both a
dispatched `KeyboardEvent` and a real `computer` tool click land on the page without
triggering Chrome's autoplay unlock. While suspended, `ctx.currentTime` is frozen at `0`, so
**any** scheduled Web Audio automation (`gain.linearRampToValueAtTime`, `setTargetAtTime`,
`osc.start(delay)`, the whole bed-crossfade and positional-drone gain curve) never progresses
— stepping the game loop doesn't help, because that's a separate clock from the audio
context's own. This isn't a product bug and there's no code fix: it's the correct, intended
browser security behavior, and a real player's first keypress/click unlocks it normally.
**The workaround for verification:** don't rely on the AudioContext clock at all. Call the
system's own gain/pan math directly as a pure function (`audioSystem['computePositional'](...)`
via bracket access) and check the returned numbers against hand-derived expected values;
separately confirm node-graph *construction* parameters (`filter.frequency.value`,
`filter.type` — these are direct property assignments, not scheduled automation, so they
apply immediately even on a suspended context) by monkey-patching `ctx.createBiquadFilter`/
`createOscillator` to record what each call configures. Both together fully verify the
synthesis logic without ever needing the context to actually produce sound.

### Late in a very long session, even a multi-second real `wait()` may not complete a tween

A landing-squash tween (`LAND_SQUASH_MS` = 90ms) stayed stuck mid-transition through a 4-second
real `wait()` — far longer than should ever be needed per the existing tween-desync gotcha
above. Likely cause: Chrome's background-tab timer throttling escalating over a long-lived
automation session, starving `forceSetTimeOut`'s own `setTimeout` chain of real ticks even
during a `wait()`. Don't assume "the existing tween gotcha's fix (a real wait) will always be
enough" — if a tween-gated state (like `Lexi.movementState` easing out of `LAND`) still won't
resolve after a few seconds of real waiting, stop trying to observe it live and instead verify
the *inputs* to that state machine directly (raw `body.velocity`/`body.blocked.down`, which
track `step(t)` accurately per the original gotcha) or test the dependent logic
(`FootstepCadence`, surface-zone lookup, etc.) in isolation from the stuck display label. This
cost real time on P3.3's footstep verification before landing on: test each contributing piece
precisely instead of chasing one end-to-end live observation that this specific session's
tab state couldn't produce.

### Arcade Physics can't "cut the corner" — a jumping body must fully clear a platform's top surface before it can pass the platform's side face

A jump arc that's still below a platform's top-surface line when it reaches the platform's
horizontal footprint gets **wall-blocked** by the platform's side face, even if the arc would
otherwise have cleared the top a moment later. This isn't a bug, it's plain AABB collision (no
corner-rounding, no "step-up" assist), but it makes eyeballed level geometry deceptive: a gap
that "looks" tall/wide enough on paper can be mathematically impossible once you account for
it, because a rising body can't cut diagonally through the corner — it must be *entirely* above
the target surface (its own bottom edge, not just its center) before advancing horizontally
into that column range.

P4.1's `ch1_02_woods` crate-boost puzzle hit this twice, both confirmed via `game.loop.step()`
frame tracing (not guesswork):

1. The elevated ledge was placed so a **fully uncut** vertical jump from the crate's top
   (`velocity.y` held until it naturally turns non-negative, no early `JUMP_CUT` release) peaked
   **1.4px short** of clearing the ledge's top surface. No amount of retiming the horizontal
   drift could fix this — the vertical ceiling on jump height (`JUMP_VELOCITY² / (2×gravity)`)
   is fixed, so if the *best possible* straight-up jump doesn't clear with margin, no diagonal
   attempt will either. Fix: move the ledge down one tile row (~30px more clearance instead of
   ~1px).
2. A side platform (the stick's spur) floating exactly 2 tile-rows above a walkable ledge left
   only 32px of clear air below it (64px gap minus the platform's own 32px), but Lexi's body is
   46px tall — a guaranteed 14px overlap that wall-blocks anyone trying to walk underneath,
   regardless of where the pair sits vertically (the deficit is `bodyHeight - (gapRows×32 -
   32)`, independent of absolute height). Any two vertically-stacked platforms need `gap ≥
   bodyHeight + platformHeight` (here, 3 tile-rows, not 2) if a walkway is meant to pass beneath.

The same issue also hit `ch1_03_stream`'s river crossing: a 103px same-height gap between the
last floating log and the far bank was small enough to *look* trivial, but both a running jump
and a plain walk-off-the-log attempt consistently hit the bank's left face 13px short of its
edge, because the fall arc dipped below the bank's surface line before reaching its column.
**When two things are at the same height** (not one elevated above the other), there's no "rise
above it first" option at all — the gap itself must be small enough to cross while still at or
above the target's surface line, which for a normal running jump is a much smaller distance
than the jump's total horizontal range would suggest. Fix: shrink the gap (moved the bank
closer), rather than trying to out-time the arc.

**When authoring/verifying a jump-reachability puzzle:** don't just check "does the max jump
height exceed the vertical gap" — separately check "is there still comfortable margin once you
account for horizontal clearance needed *before* crossing into the target's column," and for
same-height gaps, verify a *flat* crossing (not just a maximal arc) actually lands solid via
`game.loop.step()` tracing, not visual inspection of the `.tmj` coordinates.

### A prop/creature's own `update()` must be explicitly wired into `LevelLoader`'s per-frame loop, or its state changes have zero visible effect

`Crow.onBark()` correctly flips its internal `fleeing` flag (confirmed via `crow.isPerched`),
but `Crow.update()` — the method that actually moves `gameObject.x/y` once `fleeing` is true —
was never called anywhere. `LevelLoader.ts` pushes crows into the `soundReactive` array (used
only for the bark-radius lookup in `Lexi.updateBark`), but unlike `owls`/`floatingLogs`/
`windZones`, there was no matching `for (const c of crows) c.update(dt)` in the returned
`update()` closure. Symptom: barking at the crow "worked" (no error, state changed correctly)
but the crow just sat there forever — easy to miss because the bug is a *missing* line, not a
wrong one, and every other signal (event fired, flag flipped) looked correct. Fix: give it its
own tracked array (`const crows: Crow[] = []`, parallel to `owls`) and add the update loop call.
**When adding a new prop/creature type to `LevelLoader.ts`, check whether it has its own
`update(dt)` method** — if it does, it needs an explicit per-frame call in the returned closure;
being reachable via some other array (like `grabCandidates` or `soundReactive`) for a *different*
purpose does not substitute for that.

### `scene.textures.createCanvas(...)`-generated textures need a real wall-clock wait after `scene.restart()`, not just `game.loop.step()`

P4.3's `ParallaxLayers`/`FogLayers` build their silhouette textures via `scene.textures
.createCanvas(...)` + synchronous 2D-context drawing inside `buildLevel()`, called from
`create()` — that part *is* synchronous and finishes within the current call. But
`scene.restart({ map })` itself (see the existing `scene.scene.restart()`/`scene.scene.start()`
gotcha above) only takes effect once the SceneManager processes it on a real tick, and asset
loading queued in `preload()` (the tileset PNG, the `.tmj` itself) resolves via the browser's
actual network/decode pipeline — a real async operation on the browser's event loop, not
something `game.loop.step(t)`'s simulated clock advances. Stepping 30 simulated frames
immediately after calling `restart()` in one synchronous script produced `scene.children.list`
still empty and every `scene.textures.exists(...)` check `false`, even for textures a completely
separate, unrelated system (`fx-fog-blob`) had already created successfully earlier — because
the whole scene hadn't actually rebuilt yet. Inserting a genuine `await new Promise(r =>
setTimeout(r, 500-800))` between `restart()` and the first `step()` call fixed it immediately.
**Any verification script that calls `scene.restart()` on a scene whose `preload()` loads
assets needs a real await, not just more `step()` calls, before reading anything from the new
scene** — `step()` alone is only sufficient for scenes with nothing left to load.

### Monochrome silhouette layering needs a lightness *gradient*, not uniform near-black, or background depth reads as nothing

P4.3's first pass at `ParallaxLayers`' four background bands (ridge/far-trees/mid-trees/scrub)
and `Decoration.ts`'s tree/rock/bush silhouettes all used near-black fills (`0x02`–`0x0a`)
on the theory that "monochrome silhouette" meant everything should be as dark as Lexi herself.
Rendered against an also-near-black camera background (`fx/Palette.ts`'s `backgroundColor`,
itself further darkened by `fx/Grain.ts`'s always-on vignette and the fog bands sitting on top),
the result was visually almost nothing — confirmed by an actual renderer screenshot, not by
reading the hex values and assuming they'd look fine. The fix was an atmospheric-perspective
gradient: the *farthest* parallax band is the *lightest* grey (`0x2e2e2e`), each closer band
gets darker, and decorations sit a shade lighter than Lexi/gameplay props (`0x1c1c1c`/`0x26`
vs. her `0x0a0a0a`) rather than matching them — so depth reads through contrast, and Lexi/
interactive elements stay the visually darkest, most-readable layer. Also had to roughly halve
every `Palette.ts` `ambientDarkness` value for the same reason: it stacks additively with the
vignette and fog rather than replacing them, and the original values crushed everything under
it. **When tuning a new monochrome/silhouette visual layer, screenshot the actual rendered
frame before deciding the color values are right** — hex math on paper doesn't reveal that two
"different" near-black fills are visually indistinguishable once composited.

### `Camera.fade()` doesn't complete instantly either — same family as the tween-desync gotcha, different subsystem

`CheckpointSystem.fail()` (used by every hazard, and now P5.1's pause-menu "Restart at
Checkpoint") gates the actual `restoreSnapshot()` call behind `cam.fade(FADE_MS, ...)`'s
progress callback — the snapshot only applies once the fade reaches `progress >= 1`, 350ms
later. Checking Lexi's position immediately after calling `fail()` (even a few `step()` calls
later) can read the *pre-restore* position with no error, looking exactly like "restart didn't
work" — until stepping ~60 more frames (past 350ms) shows the real result. This is the same
underlying issue as the documented `scene.tweens` desync (a Phaser effects system with its own
timing that a manually-stepped clock doesn't automatically satisfy just by ticking a few
frames), but `Camera.fade()` is a different subsystem than `scene.tweens` — don't assume the
existing tween gotcha "covers" every Phaser effect; camera fades, camera shake, and any other
`Camera.*` effect need the same "step well past its stated duration, or wait for its own
callback" treatment.

### `Grain.ts`'s shader fed an unbounded, ever-growing time value into a `mediump` `sin()`-based noise function — worked fine for minutes, then degraded into visible banding

A real player reported the game going from normal grain to heavy horizontal/vertical banding
that made the screen nearly unreadable "at this point" (i.e., after some accumulated play
time, not on fresh load) — zero console errors, since nothing throws. Root cause:
`GrainPipeline.onPreRender()` sets `uTime = this.game.loop.time / 1000`, the total seconds
since the `Phaser.Game` instance booted, which **never resets** for the whole page lifetime
(menu time + every scene transition + all gameplay all add up). The fragment shader fed that
raw value into `random(outTexCoord * uTime * 100.0)`, so a few minutes into a real session the
argument to `sin()` is in the tens of thousands. `precision mediump float` (required here —
`highp` isn't guaranteed to exist on the mobile GPUs this game targets) only guarantees ~10
bits of relative precision; by the GLSL ES spec that's a *relative*, not fixed-format,
guarantee, so the absolute rounding step (the ULP) grows every time the operand magnitude
grows. Nearby pixels' inputs eventually round to the *same* quantized value, collapsing what
should be per-pixel static into visible flat bands whose width keeps growing the longer the
session runs — a bug that gets categorically worse over time, not one that's simply present or
absent. Fix: wrap the time value before it ever reaches the noise function —
`float wrappedTime = mod(uTime, 10.0);` — bounding the magnitude fed into `sin()` regardless of
real session length. No visible seam, since this is frame-to-frame static noise, not a smooth
animation.

**This class of bug is close to unverifiable on a desktop dev machine.** Chrome's ANGLE/D3D11
backend on Windows silently promotes `mediump` to full 32-bit float regardless of the shader's
declared precision qualifier — forcing `uTime` to `10,000,000` and screenshotting produced *no*
visible degradation at all in this environment, even though the bug is real and reproduces on
real (especially mobile/lower-end) GPUs that actually honor `mediump`. **Don't treat "looks
fine when I force extreme values in Chrome-on-Windows" as proof a `mediump` precision fix
worked (or that a `mediump` precision bug doesn't exist)** — verify the *mechanism*
analytically instead (does the value being fed into a `mediump` transcendental function grow
without bound as a function of session length, yes/no), not the pixels on this specific
desktop GPU/driver. **Any shader value derived from `game.loop.time` (or anything else that
accumulates for a page's whole lifetime) that feeds into a precision-sensitive function
(`sin`/`cos`/hash-style noise) needs an explicit bound (`mod`, or reseed from a per-effect
clock) before it's used — never assume "it looked fine in my testing session" is sufficient,
since agent-driven verification in this project reloads the page constantly (resetting
`game.loop.time`), which structurally hides exactly this class of bug.**

### `npm run dev`'s `DEBUG` shortcut silently skips Menu/Intro — don't diagnose a Menu/Intro visual bug against it

`BootScene.create()` does `if (DEBUG) { this.scene.start("Game"); return; }`, landing straight on
`GameScene`'s test-room fallback instead of the real `Menu -> Intro -> Game` flow. `DEBUG` is on
for `npm run dev` (fast dev-iteration) but off in a real build. Spent a full round-trip
diagnosing a reported Fog/Grain "washes out the whole screen" bug against `npm run dev` at
`localhost:5173`, taking screenshots of what I assumed was `MenuScene` — it wasn't; `Menu`'s own
`children.list` was empty (`game.scene.getScenes(true)` returned `["Game"]`, not `["Menu"]`).
The over-strong Fog/Grain stacking was real, but everything I'd looked at up to that point (a
bare test room, not the actual title screen or intro cutscene the user described) couldn't have
confirmed or denied it. Fix: use `npm run build && npm run preview` (per this file's own
Commands section — "the same way itch.io/GitHub Pages would") for any visual verification that
depends on which scene is actually showing, and confirm the active scene via
`game.scene.getScenes(true).map(s => s.scene.key)` before trusting a screenshot's content.

### Real `wait()` time and simulated `game.loop.step()` time can desync by 10x+ under Chrome's background-tab throttling — use `step()` to reach a target elapsed time, not `wait()`

Waiting 10 real seconds advanced `IntroScene.elapsedMs` by only ~350ms (throttled `setTimeout`
ticks, same underlying cause as the documented tween/`Camera.fade()` real-time gotchas above) —
reaching the intro's ball-pop/chase beat (~6s of in-scene time) by real waiting alone would have
cost minutes of wall-clock tool time. `game.loop.step(t)` with a manually incremented `t` reaches
a target `elapsedMs` in a handful of tool calls regardless of real wall-clock throttling — prefer
it over `wait()` for reaching any specific simulated timestamp, not just for held-key sequences.
One added wrinkle: each fresh `let t = performance.now()` in a **new** script-execution call
resyncs to real wall-clock time, so the first `step()` after a gap can produce a much larger
`elapsedMs` jump than `stepCount * 16.67` predicts (real time elapsed between tool calls gets
"caught up" in one step) — harmless for reaching a target elapsed time, but don't assume step
count alone predicts the resulting timestamp across separate script calls.
