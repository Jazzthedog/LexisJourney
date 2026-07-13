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
   anything from a scene you just restarted.

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
