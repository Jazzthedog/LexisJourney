# Credits

## Audio

**No external audio files are in this project.** Every sound — ambient beds, footsteps, bark,
the whistle motif, and positional one-shots (creak, splash, chain rattle) — is synthesized at
runtime with the raw Web Audio API (`src/fx/AudioSynth.ts`, `src/systems/AudioSystem.ts`):
oscillators, filtered noise, and gain envelopes, no samples. This is a placeholder, not a
final decision — the same "generate the primitive in code" approach already used for the
film grain shader (`fx/Grain.ts`) and the parallax fog texture (`fx/Fog.ts`), extended to
sound because this session had no way to browse freesound.org, preview candidates, or
download binary files to source real CC0 recordings.

**Action item for a real audio pass:** replace `AudioSynth`'s synthesized sounds with sourced
CC0 recordings from freesound.org (or an equivalent CC0 library) for:

- Ambient beds — forest, river (and one per future chapter's environment)
- Paw-step foley — grass, wood, metal (and any other surfaces new chapters introduce)
- Bark (one sample or a small set for round-robin variation)
- The 4-note family whistle motif — SPEC §1 calls for this to recur and resolve at the
  ending, so whatever set of notes/instrument is chosen should stay consistent project-wide
- Positional one-shots — creak, splash, chain rattle

When those are sourced, list each file's title, author, source URL, and license below —
**every** CC0 asset, even though CC0 doesn't legally require attribution, per this project's
own convention (PROMPTS.md P3.3).

<!--
Template for each entry once real audio is sourced:

- `public/audio/<file>` — "<title>" by <author>, <source URL>, CC0
-->

## Art

No external art assets are in this project — everything on screen is a runtime-drawn shape
or shader (see `fx/`, and every `entities/`/`props/` class's own `scene.add.*` calls). No
credits needed until a real art pass (SPEC §6 P4.3) introduces sourced or authored assets.
