# Editorial acceptance: coach variety batch

Reviewed October 5, 2026. **2,970 new lines, 99 for each of 30 coaches. Zero
open editorial findings.** Recording still requires the owner's explicit word.
No audio was generated or purchased for this writing task.

The durable manuscripts are the 30 voice-named JSON files alongside this document.
Their IDs and ordering exactly match the supplied `coach-line-prompts.zip`;
its SHA256 is recorded in `scope.json`. All 1,410 existing lines quoted in those
briefs matched current recorded text. The puzzle additions cover a correct move
with the puzzle continuing, not a completed puzzle.

## Review performed

Each coach received a complete independent 99-line review, corrections, and a
complete reread with zero open fixes, including optional polish. A separate final
reviewer then read all 2,970 lines, rather than sampling or relying on those results.

That final pass identified 25 further corrections across 13 coaches, chiefly
alternative wording that wrongly implied the played move could not have produced
the same development or pawn effect. It also improved distinctness of Bandit's
development takes. After correction, the affected coaches received another full
independent reread. Two more Bandit lines received open-file wording polish; the
existing import validator also caught a rhetorical question in Felix's otherwise
questionless voice. These were corrected and both coaches reread in full.

The separate final reviewer reread all 2,970 lines again, plus all 99 Bandit and
Felix lines after their last changes, and returned **zero open findings**. Reviews
covered factual limits, affected colour and piece, actual versus alternative,
learner ownership, personality, reserved refrains, distinct takes, and lesson,
puzzle and opening-recall stage. This initial review did not include a dedicated
meaning-by-meaning comparison across the cast; the owner requested that additional
gate below. Readiness here is editorial, not a listening test.

## Cross-cast comparison and revisions

The follow-up compared **every one of the 99 meanings side by side across all 30
coaches**, covering all 2,970 lines. It examined sentence structure, teaching
approach, rhythm, repeated framing and personality, alongside the factual rules.
Shared necessary chess terminology, short factual overlap and colour/piece pairs
were accepted; unique synonyms or decorative catchphrases were not the objective.

This produced **234 revised lines across 27 coaches**:

| Compared set | Lines read | Lines revised |
|---|---:|---:|
| Colour-named pawn/file | 600 | 66 |
| Colour-and-piece defenders | 960 | 106 |
| Development and repetition takes | 1,410 | 62 |

Representative corrections:

- Button's passed-pawn wording had Walter's sentence pair with a whimsical opener.
  It now starts with the concrete absence of opposing pawn neighbours ahead and
  derives passed status from that observation.
- Juniper's lost-defender lines used Felix's clipped verdict rhythm. Her revisions
  make a quiet observation about the missing guard without the dry verdict tail.
- Mateo's and Biscuit's alternatives now retain their curious and welcoming
  delivery; Orin uses principle then application rather than a generic comparison
  instruction; Ziggy examines relationships rather than sounding like Rivet.
- Development, capture and passed-pawn takes shed repetitive optional disclaimer
  tails. They preserve factual limits without making every coach repeat the same
  caution. Scout's alternative bishop take also gained explicit hypothetical scope.

Fresh independent reviewers then compared all three revised sets side by side,
again covering all 2,970 lines. One remaining clarity issue in Button's evaluation
loss wording was corrected: “leaves less ... behind” could imply wasting less.
The final version explicitly says the chosen move preserves less position value
than the stronger choice. That reviewer rechecked the entire 30-coach comparison
for this meaning and Button's 47 development/repetition lines, and verified the
other 1,409 reviewed records were unchanged. **All three sections ended with zero
open fixes, including optional polish.**

Exact reviewed text snapshots were checked against all current manuscripts:
2,970 of 2,970 matched, with every scoped coach/meaning pair covered once. The
handoff ZIP was refreshed from these approved manuscripts. The coach-creation
guide now requires this comparative gate for future multi-coach batches.

## Additional fresh comparison

At the owner's request, fresh reviewers repeated the complete 99-meaning,
30-coach comparison after `4016116cb`, reading all 2,970 lines without using the
previous findings to form their judgments. They found no new factual, branch,
ownership or cast-distinction problems. Two spoken-wording improvements remained:

- Arjun's actual knight development take 5 changed its heading-like opening
  (“Development, by the knight's first departure from home”) into a spoken sentence:
  “The knight develops with its first move away from home.” Its exploratory question
  remains unchanged.
- Waffles's alternative knight development take 4 replaced the awkward phrase
  “Development was on the orders!” with “A deployment worth inspecting!” The
  hypothetical first-move fact remains unchanged.

A different reviewer checked both complete 99-line manuscripts and both affected
meanings across all 30 coaches (254 unique lines), verified the other 1,408 records
in the development/repetition section were unchanged, and returned zero findings,
including optional polish. The pawn/file and defender sections passed the fresh
review unchanged. Exact current text again matches the independent signoffs for
all 2,970 coach/meaning pairs. Import, sentence-count and manuscript checks pass;
the ZIP is refreshed. The two revisions have no net effect on character counts or
the cost estimate below. No original scripts, clips or production files changed.

## Focused validation

- All 30 manuscripts contain the exact 99 unique scoped IDs in order, matching
  their registered coach and voice identities.
- No duplicate new text within a coach or exact normalized copies of that coach's
  existing authored/recorded lines; colour-paired wording is intentionally permitted.
- Colour, piece, ownership, prohibited wording, sentence length and placeholder
  checks passed. Sixteen conservative conditional-word checks were reviewed
  individually: their explicit candidate/unplayed wording preserves the alternative.
- The existing `scripts/coach_line_slots.py` `check_text` validator passed for all
  2,970 lines. Its import/promotion operation was **not** run.
- A handoff ZIP was round-trip checked: 30 JSON files in the supplied prompt format
  (`voice` and `lines`), identical to the reviewed manuscript texts and IDs. Export
  required each manuscript's SHA256 to match the combined independent cross-cast
  signoffs, which were first checked against the exact reviewed text snapshots.
- No full application or browser suite was run for these documentation-only
  manuscripts; runtime behavior was not changed by this writing work.

The local focused manuscript command was
`.venv/Scripts/python.exe -B .tools/check-coach-variety.py --complete`.
The local export check was
`.venv/Scripts/python.exe -B .tools/package-coach-variety.py`.
The comparative coverage check was
`.venv/Scripts/python.exe -B .tools/check-crosscast-review.py`.
The additional fresh comparison used that coverage check with `--fresh`.
These task-local helpers and detailed review outputs are deliberately ignored;
the acceptance record and manuscripts are the durable repository deliverables.

## Existing content preserved

The separate reviewer checked 45,527 baseline-tracked speech/dialogue files against
`90d210bd5034e4d2ac793be13d267a8c36e8e2ce`, using Git content hashes and raw-byte
comparisons, then repeated the raw-byte inventory after final edits. All original
15,114 Opus files, manifests, timing, provenance, authored text and dialogue remain
unchanged. Ten historical Walter plan files have checkout CRLF versus committed
LF; their normalized contents are identical.

Concurrent work merged in `2de5b5f7f` changes the speech README/selector and adds
planned-slot/pool infrastructure. That work is preserved and is not claimed as
part of this manuscript task. It does not alter the original recorded lines or
clips. These new manuscripts have not been imported into active scripts or banks.
The comparative revision was also checked against manuscript commit `d9f14013b`:
only manuscript/documentation files changed, with no production speech or dialogue
changes during this pass.

## Fresh recording estimate

| Set | Lines | Characters | Estimated credits |
|---|---:|---:|---:|
| Colour-named pawn/file | 600 | 63,154 | 7,638 |
| Colour-and-piece defenders | 960 | 90,590 | 10,957 |
| Extra development takes | 480 | 43,727 | 5,289 |
| Main repetition takes | 540 | 42,151 | 5,098 |
| Second-tier repetition takes | 390 | 25,285 | 3,058 |
| Total | 2,970 | 264,907 | about 32,000 |

This planning estimate applies the historical **4,270 credits / 35,305 characters**
recorded in [verification history](../../VERIFICATION.md) to the actual new text
lengths (unrounded total: about 32,039 credits). It is not a current provider quote
or a guaranteed charge. Retakes, voice/model/settings changes and pricing changes
are excluded. **Actual recording credits spent on this task: zero.**

Later integration must preserve existing piece-named defender recordings, verify
new take rotation and session scope through the shared selector, and keep missing
recordings silent/falling back appropriately. None of those future recording or
release actions is authorized by editorial acceptance alone.
