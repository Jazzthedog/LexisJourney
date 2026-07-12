# Handoff: Lexi's Journey — Begin Development (Phase 0)

## Session Metadata
- Created: 2026-07-11 16:06:23
- Project: E:\LLM-LexiJourney
- Branch: master
- Session duration: ~1 hour (design review session, no code written)

### Recent Commits (for context)
  - 707c228 Add design spec and build prompts for Lexi's Journey, with review edits
  - 7d2c14e initial commit, before fable

## Handoff Chain

- **Continues from**: None (fresh start)
- **Supersedes**: None

> This is the first handoff for this task.

## Current State Summary

This project is a 2D atmospheric puzzle-platformer in the spirit of Limbo, starring a lost dog
named Lexi. The previous session was a **design review only — zero code exists yet.** Two
documents were critically reviewed, edited, and committed: `SPEC.md` (full game specification)
and `PROMPTS.md` (a sequenced list of build prompts, P0.1 through P5.6). Your job is to
**execute the prompts in PROMPTS.md, in order, starting with P0.1**. Both documents are
authoritative and current as of commit 707c228.

## Codebase Understanding

### Architecture Overview

No code yet. The target architecture is fully specified in SPEC.md §5:
- **Stack:** Phaser 3 + TypeScript + Vite. Tiled (.tmj) for levels. localStorage for saves.
  Deploy as static web build (itch.io / GitHub Pages), Tauri wrap for Steam later.
- **Structure:** `src/main.ts`, `scenes/` (Boot, Menu, Game, UI), `entities/` (Lexi + creatures
  + props), `systems/` (Scent, Checkpoint, Clue, Audio, Save), `levels/` (Tiled maps +
  LevelLoader), `fx/` (Grain, Fog, Palette).
- **One data-driven GameScene runs all levels**; puzzles wire via string IDs in Tiled object
  properties (`lever_01 → gate_01`). New content = new map file, not new code.

### Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| SPEC.md | Full game design + tech spec | Read FIRST, before any code. Referenced by every prompt |
| PROMPTS.md | Ordered build prompts P0.1–P5.6 with verify steps | Your work queue — execute top to bottom |
| LexiJourney-notes.txt | Owner's personal notes | Reference only; SPEC.md wins on conflict |

### Key Patterns Discovered

- Every prompt in PROMPTS.md ends with a **Verify** step — do not proceed to the next prompt
  until it passes. Commit after each verified prompt.
- The "Working rules" section at the bottom of PROMPTS.md applies to every session:
  feel before features, one system per session, data over code, the screenshot test, trash freely.

## Work Completed

### Tasks Finished

- [x] Critical design/tech review of SPEC.md and PROMPTS.md (scope, mechanics, engine choice, prompt ordering)
- [x] 18 targeted edits applied to both documents and committed (707c228)
- [x] Scope decision framework added: go/no-go GATE after the vertical slice (P5.1)

### Files Modified

| File | Changes | Rationale |
|------|---------|-----------|
| SPEC.md | Physics decision locked (Arcade-only + scripted props); Sniff Mode anti-highlight rules; bark attract-cost; scarf worn not carried; Ch.3 ally constrained to stations; Ch.2 wind telegraph rules; M5 go/no-go gate; Memory Tokens buff ScentSystem | De-risk scope and mechanics before code |
| PROMPTS.md | Deploy added to P0.1; new P0.3 debug harness; InputMap + gamepad in P1.1; scripted-props note in P2.1; station-ally in P2.3; Ch.1 = 5 maps in P4.1; pause menu + mobile perf in P5.1; GATE section before P5.2; token scent-buff in P3.2 | Fix ordering gaps and align prompts with SPEC decisions |

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| Phaser 3 + TS, not Godot 4 | Godot 4 (better built-in 2D physics/joints) | Web-first distribution, code-file-centric AI workflow; Godot wasm export heavy + needs COOP/COEP headers |
| Arcade Physics ONLY; rope/seesaw/pulley/logs are scripted kinematic props, NOT simulated | Matter.js (real joints) | Character feel (M1 priority) far easier in Arcade; deterministic; silhouettes hide fakery. Matter is fallback ONLY if scripted props feel dead at M2 — decide once there, never drift |
| Always-run movement, no walk toggle | Hold-to-run | Shift is taken by Sniff; simpler; Limbo-style |
| Memory Tokens permanently buff scent wisps (brightness/range/linger) | Cosmetic-only collectibles | Systemic reward for exploration; never a gate since Sniff is never puzzle-required |
| v1 may re-scope to 3 chapters at the GATE | 5 chapters committed upfront | Ch.3 LOST DOG poster beat works as interim ending; decide after stranger playtests |

## Pending Work

### Immediate Next Steps

1. **Read SPEC.md in full, then PROMPTS.md in full.** Do not skim — the physics note in SPEC §5
   and the Working Rules in PROMPTS.md govern everything.
2. **Execute P0.1** (project skeleton: Vite + TS + Phaser 3, folder structure, 1280×720 config,
   BootScene → empty GameScene, deploy path). Run its Verify step. Commit.
3. **Continue prompt by prompt**: P0.2 (grain/fog/vignette mood layer) → P0.3 (debug harness) →
   P1.1 (movement core — this one is done when jumping feels FUN, not when it compiles).

### Blockers/Open Questions

- [ ] Deploy target choice in P0.1 (itch.io vs GitHub Pages): pick either; itch.io preferred
      per SPEC §5. Ask the owner only if account setup is needed.
- [ ] No art or audio assets exist yet — use placeholder rectangles/capsules exactly as the
      prompts specify until P4.3 (art pass).

### Deferred Items

- Chapters 2–5 scope: intentionally deferred to the GATE after P5.1 (stranger playtest of the
  Chapter 1 vertical slice). Do not pre-build content for later chapters.
- Steam/Tauri wrap (P5.6): explicitly last.

## Context for Resuming Agent

### Important Context

**The single most important constraint: DO NOT introduce Matter.js.** SPEC §5's physics note
locks Arcade Physics before M1. Seesaws, ropes, pulleys, counterweights, and floating logs are
scripted kinematic props that *look* physical (seesaw lerps rotation from weight distribution;
logs are bobbing kinematic platforms carrying current velocity). If a scripted prop feels dead
during Phase 2, stop and flag it to the owner rather than switching engines — switching after
movement tuning destroys the M1 work.

Second: **P1.1 (movement) has a feel bar, not a feature bar.** Coyote time, jump buffering,
variable jump height, acceleration curves, camera look-ahead — iterate on the numbers in a test
room until jumping around is fun by itself. Route input through an InputMap supporting keyboard
AND gamepad from day one.

Third: **verify steps are gates.** Each prompt's Verify must pass before the next prompt starts,
and each verified prompt gets its own commit.

### Assumptions Made

- The owner (solo, AI-assisted developer) runs sessions one prompt at a time per the Working
  Rules ("one system per session").
- Node.js/npm are available on this machine (unverified — check before P0.1 and install if not).
- Branch stays `master` (repo's main branch is master despite tooling defaults suggesting main).

### Potential Gotchas

- **Windows environment** (PowerShell 5.1 primary): no `&&` chaining in PowerShell; watch
  UTF-16 default encoding if writing files via shell — prefer dedicated file tools.
- Phaser 3 + Vite needs assets under `public/` for static serving; Tiled `.tmj` files load via
  Phaser's tilemap JSON loader.
- GitHub Pages serves from a subpath — set Vite `base` accordingly if that deploy target is chosen.
- P0.2's verify is aesthetic ("does the empty screen feel Limbo-ish?") — screenshot it and ask
  the owner to judge if uncertain.
- The Memory Token scent buff (P3.2) must persist through save/reload — it's part of that
  prompt's verify.

## Environment State

### Tools/Services Used

- Git (repo initialized, 2 commits on master)
- No build tooling installed yet — P0.1 creates the entire toolchain (Vite, TypeScript, Phaser 3)

### Active Processes

- None. No dev server exists yet.

### Environment Variables

- None required yet. None should ever be needed for v1 (no backend, localStorage saves).

## Related Resources

- `SPEC.md` — game specification (authoritative)
- `PROMPTS.md` — build prompt sequence (the work queue)
- Phaser 3 docs: https://newdocs.phaser.io/
- Tiled map editor: https://www.mapeditor.org/
- CC0 audio for P3.3: https://freesound.org/

---

**Security Reminder**: Before finalizing, run `validate_handoff.py` to check for accidental secret exposure.
