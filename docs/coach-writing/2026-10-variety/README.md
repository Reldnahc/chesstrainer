# Coach variety manuscripts

Owner-requested writing batch, October 5, 2026. These are proposed additions,
not active scripts, recordings or a runtime catalogue. Recording requires the
owner's explicit instruction. Existing lines and clips must remain byte-identical.

All 2,970 lines have completed independent editorial review. See the
[acceptance and recording estimate](REVIEW.md). This is writing approval only;
recording is not authorized.

`scope.json` defines 99 new slots for each of the 30 registered coaches:

| Set | Per coach | All coaches |
|---|---:|---:|
| Colour-named pawn/file lines | 20 | 600 |
| Colour-and-piece-named defender lines | 32 | 960 |
| Extra piece development takes | 16 | 480 |
| Main repetition takes | 18 | 540 |
| Second-tier repetition takes | 13 | 390 |
| Total | 99 | 2,970 |

Each `<voice>.json` contains `schemaVersion`, `coachId`, `voiceId` and `records`
of `{id, text}` in scope order. IDs are proposed additive identities, not changes
to the production meanings. The scope identifies the existing meaning, branch,
piece, colour and take number that each proposed line belongs to.

## Writing and review contract

Read [Dialogue writing and review rules](../../COACH_CREATION_GUIDE.md#dialogue-writing-and-review-rules),
[character writing](../../COACH_PERSONALITIES.md) and the relevant entry in the
[cast bible](../../COACH_CAST_BIBLE.md). Compare each character's current recorded
manifest and authored scripts before writing. Do not copy another character's
prose and decorate it with a catchphrase. Do not change any existing line.

The factual limits used by this batch are:

- A passed pawn has no enemy pawn ahead on its own or adjacent files. It can
  still be blocked or captured; no promise of an open path or promotion.
- An isolated pawn has no friendly pawn on an adjacent file. It may have piece
  support and is not automatically lost or attacked.
- Doubled pawns share a file; do not assert exactly two, a particular file or
  that the structure is necessarily bad.
- An open rook file has no pawns of either colour. A half-open/semi-open rook
  file has no friendly pawn and at least one enemy pawn. Neither guarantees
  rook mobility, an invasion, a target, king danger or a win.
- Defender gained means previously no defender, now at least one. Defender lost
  means previously defended, now no defender. Neither proves a legal capture,
  a tactical loss, complete safety or lack of attacking pieces. Name the colour
  and exact knight/bishop/rook/queen in every colour-defender line.
- Actual lines state the resulting fact. Alternative lines explicitly refer to
  another/better move and remain hypothetical. Colour is the affected side,
  not necessarily the mover's side. No learner ownership in either branch.
- Development here is a knight/bishop leaving its original square for the first
  time. No assertion that it attacks something, controls the centre, escapes a
  threat, completes development or is necessarily a good move.
- Evaluation loss is a cost relative to the stronger choice, not necessarily a
  losing position, lost material or lost mate. A reply capture need not be free
  or profitable. A reply check need not win material or force mate.
- `chance-taken` is learner-gated successful punishment of an opponent error;
  it does not imply the whole game is won. Stronger alternative lines must work
  as a second sentence without relying on an invented target or mechanism.
- Best and Good remain distinct. Grade takes are side-neutral, with no engine
  rank/margin jargon, material claims or learner ownership.
- Passed-pawn push refers to the actual advance, not guaranteed promotion.
- Lesson correct means the intended lesson move; puzzle next-move means a correct
  move with more of the puzzle still to solve; opening accepted means the stored repertoire answer.
  These learner-directed lines may address the learner. Do not call an authored
  answer objectively best, invent course content or claim learning transfer.

`you`, `your` and `our` are excluded from lines that can play on either side's
move. Do not write Maia readings, combine recordings, add jokes to every animal
line, use another coach's reserved refrain, or use ambiguous separate/separately.
Pairwise White/Black versions may share wording apart from colour; needless
synonyms must not distort a fact. Added takes should offer real phrasing variety
against their existing take as well as one another.

## Reviews and release boundary

The supplied `coach-line-prompts.zip` contains one brief per coach; its fingerprint
is preserved in `scope.json`. All 30 agree on the same 99 slot IDs. Those exact IDs
and their order are used here, including `puzzle-next-move` rather than puzzle
completion. The supplied briefs are reference material; their chat-output format
does not change this repository's manuscript format or authorize recording.

Each coach receives an independent complete review, including optional polish.
Writers address every finding; reviewers reread until the complete result has
zero open fixes. A separate final reviewer reads every new line and checks that
the old scripts/recordings are unchanged. Review results belong in `REVIEW.md`.

Any later integration must preserve all existing piece-named defender clips,
add colour-and-piece variants without replacing that pool, extend the shared
take picker for non-grade meanings/development, and give lessons, puzzles and
opening recall their own session order. These manuscripts do not enable that
runtime behavior or authorize recording. Estimates use actual manuscript lengths
and historical recording costs, and are not a provider quote.
