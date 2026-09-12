# Classification assessment — September 12, 2026

This assessment combines read-only coverage measurement, a blinded assistant review, native defensive searches and regression fixtures. It does not add an LLM to the application. Private positions, annotations and reports stay in ignored `data/`; only methodology, aggregate results and reduced synthetic regression fixtures are committed.

## Coverage

The fixed starting collection contains 100 games and 395 meaningful learner decisions. Counts below describe decisions with at least one finding of each kind; outcomes and mechanisms overlap.

| Stage | Material/mate outcome | Specific mechanism |
|---|---:|---:|
| Existing v2 service | 183 | 50 |
| Adaptive saved endpoints | 265 | 68 |
| Connected combinations and move causes | 265 | 103 |
| v3, after 40 selected positions received native enrichment | 278 | 117 |
| v3.1 audit corrections, using exactly the same frozen engine evidence | 278 | 127 |
| v3.1 after a further bounded 16-position native run on the copy | 280 | 130 |

The first native batch persisted 46 additional tail/defensive results alongside its best/actual root comparisons. The second batch resolved the pending defensive questions. Its changed evidence was not scored with the old annotations. No original decision analysis reference, accepted answer or review schedule was replaced. Coverage is not label accuracy: recognizing a material outcome does not establish its tactical mechanism.

## Blinded assessment

The exporter selected 24 positions across rare mechanisms, common outcomes and abstentions, then omitted predictions, sampling strata and defensive-hypothesis names. The assistant reviewed the raw positions, prior moves, learner-perspective engine scores, legal continuations and tested defenses. Expected labels and uncertainty were saved before revealing classifier predictions.

Twenty-two positions received complete annotations. Two complex cases remained uncertain and were excluded rather than treated as negative examples. Game-based splitting left 19 completed development examples and only three holdout examples. No holdout disagreement drove a rule change, but three examples are insufficient for an accuracy estimate.

Original v3 agreement with the original blind annotations:

| Label group | Agreed labels | Unexpected labels | Missed labels | Precision | Recall |
|---|---:|---:|---:|---:|---:|
| Outcomes | 28 | 0 | 0 | 100% | 100% |
| Mechanisms | 23 | 4 | 8 | 85.2% | 74.2% |

The four unexpected mechanism labels included an annotation error: python-chess confirmed a double check the reviewer had missed. Three were classifier problems: two incidental defender-removal labels and one deflection whose defender remained aligned but pinned. The original annotations and comparison are preserved.

## Corrections and adjudication

Changes based on the development examples:

- Distinguish a free queen/rook capture followed by pawn cleanup from a meaningful defender-removal sequence.
- Recognize an initially hanging piece even when later partial compensation reduces the net loss. Require an immediate gain as well, so an equal queen trade followed by a later loss cannot count as a hung queen.
- Allow checking captures to deflect defenders, but require the defender to leave the geometric defense. Becoming pinned is a separate pattern.
- Trace a newly pinned victim through a legal capture along its pin ray.
- Recognize a preceding move that releases a relative pin and makes the opponent's capture effective.
- Add bounded native hypotheses for a sacrificed forker whose other target is collected by another piece, and an attacked relatively pinned piece whose legal escapes expose the more valuable piece behind it.

A separate adjudicated annotation file records two reviewer corrections. Besides the double check, a previous pawn move demonstrably removed a knight's relative pin; python-chess validated the earlier hypothetical capture and exposed-queen capture. This extra cause was missing from the first annotation. The original blind file was not edited.

On the same frozen evidence, v3.1 agrees with 30 adjudicated mechanism labels, has no remaining unexpected labels, and misses three labels. These are **development diagnostics after inspecting disagreements**, not a new blind score. The three misses include economically ineffective extra defenders and two cases awaiting the new targeted queries. Original v3 against these adjudicated labels has 24 agreements, three unexpected labels and nine misses. All 28 outcome labels still agree, but uncertain cases remain outside these totals.

## Repeating the assessment

1. Freeze a read-only report and blind packet: `python scripts/classification_report.py --output data/frozen.json --sample data/blind.csv --sample-size 60 --blind`.
2. Annotate both expected-label columns using controlled IDs. Record reviewer identity/protocol and leave uncertain rows incomplete. Keep holdout games out of rule tuning.
3. Compare with the frozen report: `python scripts/classification_report.py --from-report data/frozen.json --annotations data/annotated.csv --reviewer-kind assistant --reviewer-id "Reviewer identity" --output data/evaluated.json`.
4. Preserve the original comparison. Record adjudications separately with concrete reasons and any independent chess verification. Re-export changed engine evidence; do not silently reuse old annotations after enrichment.

The CLI validates evidence fingerprints, prevents mixed human/assistant cohorts, rejects duplicate or unknown labels, and reports per-label and split metrics. No native search or external model call runs during comparison.

## Limits and next validation

The reviewer also wrote the rules, so hiding predictions does not remove shared implementation assumptions. Stratification deliberately overrepresents rare patterns, and this small sample is not an estimate of population accuracy. A finite quiet continuation can still omit a later recapture, and a selected native defensive branch does not prove every possible defense fails. Some unclear cases need a chess expert's adjudication.

The next quality milestone is a larger, independent human-reviewed set of unseen games, reporting each mechanism's precision/recall and reviewing abstentions as well as positive labels. Long-term learner improvement is a separate product outcome. Do not present this assessment as proof that the classifier is fully accurate.
