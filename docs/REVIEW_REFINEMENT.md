# Targeted review investigation

Full-game review first saves the existing deep Stockfish analysis for **every
move**. A finite second phase investigates critical or uncertain positions. No
cheap survey replaces that baseline. Set `REVIEW_REFINEMENT_POSITIONS=0` to keep
the baseline alone; completed deeper evidence already saved remains available.

## Selection and budgets

Baseline facts nominate newly allowed/lost mate, large concessions, verified
sacrifices, narrow defensive resources, critical alternatives, unusual model
best moves, weakly explained concessions, grading boundaries and missed gains.
Priority is deterministic; ties use ply order. Only the baseline nominates work,
so a refined finding cannot trigger an unbounded recursive investigation.

| Variable | Default | Bounds / effect |
| --- | --- | --- |
| `REVIEW_REFINEMENT_POSITIONS` | 8 | 0–128 positions per game; 0 disables extra work |
| `REVIEW_REFINEMENT_QUERIES` | 4 | 2–8 total searches per position, including acceptance probes |
| `REVIEW_REFINEMENT_DEPTH` | 22 | 1–50 requested depth |
| `REVIEW_REFINEMENT_TIME` | 2 | >0–10 seconds per search |
| `REVIEW_REFINEMENT_MULTIPV` | 4 | 2–8 candidates for narrow resources, critical alternatives, sacrifices and human disagreement |

Ordinary severity/boundary checks use two root candidates. Wider searches answer
alternative questions; restricted searches compare the played move and sacrifice
acceptance. If budget remains, an uncovered top human candidate is compared too.
The worker does not rerun Maia. Model probabilities remain behavioral evidence.

The effective depth/time never fall below the saved baseline's requested profile;
extra searches have no node cap. At defaults the ceiling is 8 × 4 × 2 = **64
seconds of native search per game**, plus process/SQLite/evidence overhead and
shared-slot wait. A host with a baseline time over two seconds raises that ceiling
accordingly. Depth can finish a search early. This is a budget, not a latency
promise. Searches share the existing engine slots and threads/hash limits. No new
unbounded executor or account-specific native pool is introduced.

Pause interrupts an active extra search or a wait for a slot/cache lock. Startup
and engine teardown retain the native transport's bounded timeouts. Partial
search output is never cached. Already finished questions are saved immediately
and reused after cancellation or restart; no database transaction spans a search.

## Stored evidence and display

`GameReviewMove.report` retains baseline chess facts. Account-owned
`ReviewRefinement` records retain triggers, pinned Stockfish binary/version,
search profile, human configuration provenance, per-question cache references,
completion status and the investigated report. A finite plan on `GameReview`
records task IDs and progress. These contain no coach-specific dialogue.

Completed evidence is adopted only with the same engine, at least baseline depth
for the actual/best/root comparisons, and consistent best-versus-played ordering.
Budget exhaustion or unavailable/incompatible engines leaves the baseline usable.
An optional human-alternative query failure cannot discard a completed root
comparison. Diagnostics retain why an investigation was not adopted.

One effective-report reader supplies detail/progress, with equivalent batched
score selection for library accuracy. It checks task game/ply and original
analysis IDs. Preceding-move comparisons use the same effective score generation.
If refinement changes the best move, the saved complete human policy is projected
onto that move without native inference. Owner scoping applies to tasks and human
evidence; cross-account references are rejected on writes.

Monotonic report revisions let polls receive changes to **earlier** plies, including
the next move when its preceding-score comparison changes. Cursors advance only
over actual returned updates. Legacy `after=ply` remains available; current clients
use `after_revision`. The UI shows progress during baseline analysis, then hides
the progress panel while investigation runs in the background. Polling continues
to apply deeper findings without changing the selected position; review remains
playable during either phase. Interrupted or failed jobs still expose resume/retry
controls and errors.

Opening a completed legacy review without a refinement plan queues its one extra
pass when enabled. Reopening a completed compatible plan is idempotent. An explicit
`POST /api/games/{id}/review` with `{"refine":true}` plans against current host
settings and retries unavailable questions; this is also available to development
tools. Completed compatible questions are reused, not forcibly rerun. Changing
coach has no effect on this pipeline.

## Measured evidence and limits

```sh
python scripts/benchmark_refinement.py --stockfish /path/to/stockfish --output data/review-benchmark/refinement.json
python scripts/benchmark_refinement.py --stockfish /path/to/stockfish --targeted --output data/review-benchmark/refinement-targeted.json
```

The harness uses disposable databases and the production planner/search/report
reader. Outputs are exclusive-create under ignored data storage, never source.
Stockfish 18 on the M0 Windows host, default 16/0.8 baseline and 22/2 refinement:

- The original twelve-position synthetic corpus nominated four cases: allowed
  mate, missed mate, queen sacrifice and Bongcloud. All baseline grades survived;
  investigations took 2.343, 3.777, 3.928 and 3.121 seconds respectively. Stored
  baseline reports were byte-for-byte equivalent as decoded JSON. Wider/deeper
  lines can produce different supported motifs; this is not global ground truth.
- A targeted public Lichess probe (`C0OA7`) initially had Great / depth 16 with no
  supported sacrifice. The investigation reached depth 20, found removal of the
  defender, and tested `...Be3` followed by `fxe3`: Stockfish found mate in seven
  for Black. Fieldwork's existing sacrifice rule then supported Brilliant.
  Investigation took 2.344 seconds. This is a concrete explanatory improvement.
- The second public control (`6JpC8`) stayed Best and was not nominated because
  its baseline alternative gap was 77 cp, outside the critical-gap trigger.
  Deliberately investigating it during discovery produced a different gap/grade;
  bounded selection does **not** promise to find every such change.

Those two positions were selected from twelve hard positions in the existing
public CC0 puzzle snapshot, not a blind evaluation sample. Their provenance is
in `scripts/review_benchmark/refinement_cases.json`. These measurements establish
selected improvements and finite behavior, not a general accuracy percentage or
timing guarantee. Time-limited cold searches can vary across machines/runs.
