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
puzzle and opening-recall stage. Readiness here is editorial, not a listening test.

## Focused validation

- All 30 manuscripts contain the exact 99 unique scoped IDs in order, matching
  their registered coach and voice identities.
- No duplicate new text within a coach or exact normalized copies of that coach's
  existing authored/recorded lines; colour-paired wording is intentionally permitted.
- Colour, piece, ownership, prohibited wording, sentence length and placeholder
  checks passed. Fourteen conservative conditional-word checks were reviewed
  individually: their explicit candidate/unplayed wording preserves the alternative.
- The existing `scripts/coach_line_slots.py` `check_text` validator passed for all
  2,970 lines. Its import/promotion operation was **not** run.
- A handoff ZIP was round-trip checked: 30 JSON files in the supplied prompt format
  (`voice` and `lines`), identical to the reviewed manuscript texts and IDs. Export
  required each manuscript's SHA256 to match its final independent review.
- No full application or browser suite was run for these documentation-only
  manuscripts; runtime behavior was not changed by this writing work.

The local focused manuscript command was
`.venv/Scripts/python.exe -B .tools/check-coach-variety.py --complete`.
The local export check was
`.venv/Scripts/python.exe -B .tools/package-coach-variety.py`.
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

## Fresh recording estimate

| Set | Lines | Characters | Estimated credits |
|---|---:|---:|---:|
| Colour-named pawn/file | 600 | 62,568 | 7,567 |
| Colour-and-piece defenders | 960 | 90,904 | 10,994 |
| Extra development takes | 480 | 43,884 | 5,308 |
| Main repetition takes | 540 | 42,237 | 5,108 |
| Second-tier repetition takes | 390 | 25,337 | 3,064 |
| Total | 2,970 | 264,930 | about 32,000 |

This planning estimate applies the historical **4,270 credits / 35,305 characters**
recorded in [verification history](../../VERIFICATION.md) to the actual new text
lengths (unrounded total: about 32,042 credits). It is not a current provider quote
or a guaranteed charge. Retakes, voice/model/settings changes and pricing changes
are excluded. **Actual recording credits spent on this task: zero.**

Later integration must preserve existing piece-named defender recordings, verify
new take rotation and session scope through the shared selector, and keep missing
recordings silent/falling back appropriately. None of those future recording or
release actions is authorized by editorial acceptance alone.
