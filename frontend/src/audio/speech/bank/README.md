# Walter's non-lesson voice bank

The owner approved completing Walter on October 1, 2026 after choosing **Older
teacher** and approving the revised automatic mouth generator. This bank uses
that saved voice, `Q5CWGTzNfIve6iWvrlM7`, with the same Eleven v4 delivery settings
as the eight approved contrasting examples.

`manifest.json` describes **181 complete spoken summaries**, totaling **16,936
input characters**. Eight unchanged recordings are referenced from the original
contrast directory; they are not copied or regenerated. The other **173 scripts
contain 16,106 input characters**. Character counts describe input, not measured
provider billing. Every recording is a whole passage; no word fragments are
stitched together.

The bank covers 92 game-review meanings, 68 additional SRS/explanation meanings,
10 opening recall/preview meanings, eight puzzle states and three finite game
statuses. Shared recordings retain their aliases in the
[full inventory](../walter-full-dialogue-inventory.json). All lesson narration
remains deferred. Four transient or defensive states are deliberately unrecorded:
game thinking, practice checking, explanation loading and no-renderable-claim.

## Authoring and verification

Nine executable plans in `plans/` retain the recorder's maximum of 20 requests
per plan. From the repository root, inspect a batch without network, credentials
or spending:

```sh
node scripts/record_coach_speech.mjs --plan frontend/src/audio/speech/bank/plans/walter-01.json --output frontend/src/audio/speech/bank/recordings
```

Only an explicitly authorized authoring run adds `--generate`. Generation is
sequential, never automatically retried, and valid existing recordings are
reused. Each output has an exact request and hash sidecar. Builds and playback
never contact ElevenLabs. The manifest's media, sidecar and alignment paths are
relative to this directory. New media uses `recordings/walter/`; all generated
mouth tracks use `alignment/<recording-id>.json`.

The selected voice's paid-period generation and redistribution terms are
documented in the [speech permissions notice](../README.md#permissions-and-attribution).
Voice media is separate from the repository's code license and CC0 sound effects.
Keep request provenance with the media. No provider key belongs in the manifest,
application, container or Git.

## Meaning and playback boundaries

The [game inventory](../walter-dialogue-inventory.json) and full inventory preserve
the supporting branches and evidence requirements for each script. The bank's
presence does not independently authorize speech:

- Select the first **successfully rendered** primary claim, preserving its exact
  identity. A missing primary recording must not silently promote another claim.
- Secondary claims, human insights and explanation findings need an explicitly
  selected visible surface. Never narrate unopened popovers or disclosures.
- Preserve played, allowed, missed and hypothetical positional scope. Match
  tactical witnesses and required slots; never infer a tactic from a grade,
  portrait expression or English prose.
- Checkmate speech requires actual board termination, not a recorded result or
  facial reaction. An allowed forced mate and a completed checkmate are different
  claims. Model likelihood remains an estimate, separate from engine evaluation.
- Cold SRS may give neutral instructions, never answer hints. Attempt/reveal
  authorization gates all tactical, summary and continuation speech. Reveals
  cannot sound like unassisted success, and restored feedback is not a new reward.
- Current session, position, attempt, coach and selected claim must still match
  after an asynchronous load. Navigation, retry, mute, hiding and unmounting must
  cancel obsolete speech. Background refinement must not replay narration.
- Opening acceptance is repertoire membership; puzzle acceptance is the authored
  answer. Neither asserts an objective Best move. Raw errors, arbitrary manual
  prose and imported commentary remain written.

Detailed moves, squares, scores, player names and historical counts stay visible
in the written explanation. Audio summarizes the supported idea without replacing
the facts or creating a second reasoning system.
