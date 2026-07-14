# Decisions

Project-level go/no-go calls that change scope, not implementation details — the kind PROMPTS.md's
own gates ask to be written down rather than made silently. One entry per decision, newest first.

---

## GATE — Vertical-slice review (post-P5.1)

**Date:** 2026-07-13
**Trigger:** PROMPTS.md's "GATE — vertical-slice review (do not skip)," required before starting P5.2.
**Reference:** SPEC.md §6, "Gate after M5 (go/no-go)."

### What SPEC §6 actually asks this gate to validate

> the vertical slice — Chapter 1 polished, deployed, played by **strangers** — is a decision point,
> not a formality. Validate fun and audience response before committing to four more chapters.

The bar is explicit: *played by strangers*. Not the developer, not an AI agent driving synthetic
input. That's the piece of evidence this decision is supposed to turn on.

### What evidence actually exists right now

**No stranger has played this build yet.** The public URL (`https://jazzthedog.github.io/LexisJourney/`)
went live in this same session, immediately before this gate. Zero real playtester sessions have
happened. That's the honest starting point, not a caveat to bury.

What *does* exist is extensive agent-driven verification across every P4.x/P5.1 prompt — `game.loop.step()`
frame tracing plus synthetic keyboard/pointer/touch input, run repeatedly against all five Chapter 1
maps, the intro, menu, pause flow, and touch controls. That's real functional coverage (every puzzle
is solvable, every checkpoint fires, every token is collectible, the chapter chains start-to-finish),
but it is not the same instrument as a human's first honest reaction. An agent with frame-perfect
synthetic input doesn't experience "fun," "lost," or "frustrated" — it experiences "pass" or "fail."
Treat everything below as risk signal, not audience response.

### What the verification process did surface, worth flagging honestly

Three separate maps needed a genuine geometry fix *after* first appearing to work, all from the same
underlying cause: Arcade Physics' AABB collision can't "cut a corner" (a rising body must fully clear
a platform's top surface before it can pass the platform's side face). This wasn't a one-off:

- `ch1_02_woods`' crate-boost ledge originally left ~1px of jump clearance — mathematically short
  even with a perfectly-executed jump, not a timing issue (see `CLAUDE.md`).
- The same map's stick-token spur had a headroom overlap that blocked walking underneath it.
- `ch1_03_stream`'s far bank was a few pixels out of a floating log's reach for the identical
  corner-collision reason.

All three are fixed and re-verified with real margin, not just "technically passes." But the pattern
itself — three independent puzzle beats built to the same numeric proportions as an already-proven
reference room, and three of them landing right at (or past) the edge of what the physics allows —
suggests the geometry-tuning margin in this pipeline runs thinner than intended by default. A human
player doesn't get to retry with frame-exact input the way this session's verification did; several
of Chapter 1's "boost" jumps (crate-boost, the spur, floating-log timing) took this agent multiple
real attempts even *after* the geometry was confirmed solvable. Solvable-in-principle and
casual-friendly-in-practice (SPEC's stated "Everyone... casual players" audience) are different bars,
and only the first one has been checked.

Set against that: the things SPEC cares about structurally *do* check out. Teaching order is
respected (every verb gets a safe room before a hazard uses it). Checkpoints are generous (every
puzzle, confirmed via the pause menu's "Restart at Checkpoint" and every hazard's fail path). Fail
states are non-punishing (instant respawn, no lives/score). The owl encounter is confirmed
*escapable-not-a-coin-flip* (a naive walk-through gets caught; bait-and-retreat clears it every time).
The wordless intro conveys the premise structurally (car, ball, chase, gate, departure, alone) without
any text. None of that is nothing — it's just not the same as knowing whether it lands emotionally.

### The decision

**Re-scope the near-term plan to three chapters (Forest → Storm → Junkyard, ending on Ch. 3's LOST
DOG poster beat), matching the "honest fallback" SPEC.md §6 already pre-declared for exactly this
situation** — not because the evidence says "no," but because the evidence needed for a confident
"yes" (stranger playtesting) doesn't exist yet, and SPEC itself names this fallback rather than
leaving it for me to invent under uncertainty.

Concretely, for what happens next:

1. **P5.2 (Chapter 2) and a Chapter-3-as-possible-ending build are still the next work**, unchanged
   from PROMPTS.md — this decision doesn't stop building, it stops the *five-chapter commitment*
   specifically, since Ch. 2–3 are needed either way (three-chapter fallback or full five).
2. **Before or alongside P5.2, get the now-live URL in front of actual strangers.** This is the one
   piece of evidence this whole gate exists to gather, and it's now genuinely possible for the first
   time. A handful of honest first-reaction sessions on Chapter 1 (where do they quit, get lost,
   laugh, say "oh" at the ball/car beat) is worth more than any further agent-driven verification.
3. **A second, lighter gate after Chapter 3 ships**, once real playtester reactions exist, decides
   between: ship the three-chapter version as v1 (Ch. 4–5 become a v1.1, exactly as SPEC.md §6
   frames it) versus continue straight through to Ch. 4–5 for the original five-chapter v1. That
   decision gets to use the evidence this one couldn't.
4. **Nothing built is discarded either way.** Chapters are independent map files (PROMPTS.md's own
   stated reason this is cheap to revisit) — this is a sequencing and commitment decision, not a
   deletion. SPEC.md's full five-chapter design stays as the authoritative long-term vision;
   `PROMPTS.md`'s P5.2–P5.6 text is left unedited on purpose. This document takes precedence over
   the "one prompt per chapter, Ch2–5 batched" framing there until superseded by the post-Ch.3 gate.

### What would change this call

Real playtester sessions showing strong engagement and low friction through Chapter 1 (and ideally
Chapter 2) would be grounds to skip straight to the full five-chapter commitment at the post-Ch.3
gate, or even revisit skipping that gate entirely. Conversely, sessions showing players bouncing off
Chapter 1's precision-execution moments would be grounds to treat the corner-collision pattern above
as a pipeline problem worth fixing generally (e.g. wider default margins in the map generator) before
building anything past Chapter 3.
