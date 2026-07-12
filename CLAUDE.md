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
