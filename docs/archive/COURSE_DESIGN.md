# Archived course design

Historical snapshot preserved September 13, 2026. The course and lesson behavior below is no longer an active workflow. For current weakness priorities, focused practice and compatibility boundaries, see [CURRICULUM_ENGINE.md](../CURRICULUM_ENGINE.md). Older present-tense statements describe the archived implementation.

---

# Curriculum and lessons

Lessons are removed from the active product. Course navigation and frontend lesson components are gone; lesson/course endpoints return HTTP 410. Existing lesson sessions cannot be graded or revealed through review endpoints. Historical tables, snapshots and archived domain code remain for data compatibility and a possible future redesign. Ordinary Review and local mistake classification are the active learning loop.

Migration d17b63e02a48 releases nonretired SRS states held by existing lesson items. Only eligibility changes; card state, due dates, attempts, reviews, retirement and lesson records remain intact. No production route or job can enroll new cards into lessons.

## Classification authority and quality

Taxonomy v2 retains historical IDs and adds allowed_mate, missed_mate, material_loss and missed_material_gain. Local rules emit findings from saved engine evidence; unsupported causes remain unclassified. See LOCAL_CLASSIFICATION.md for exact coverage.

The latest successful local rule run determines active skill evidence. ClassificationRun preserves historical and current responses with provider/version provenance. Old LLM evidence is inactive after migration, with audits retained. Failed or malformed local runs preserve current labels; a successful abstention removes earlier asserted labels. Cached runs restore the corresponding projection without recomputation.

The learner can reject an unsupported finding through its classification audit. It remains preserved but inactive. Identical rejected rule/evidence/configuration results are not automatically retried. Objective analysis, exercise answers and review history remain unchanged.

Local explanations are templates filled from verified events. Rule accuracy and improvement outcomes still require evaluation; a valid schema alone does not prove a causal label correct. No perfect motif detector or scientific mastery score is claimed.

## Priorities and grouping

Independence means distinct game IDs. Each game's contribution is its maximum evidence-weight x bounded-severity x recency value. Mate transitions have severity 3; ordinary loss scales by 150 cp, capped at 3. Recency halves over 90 days using analysis time, not historical game date. Foundational skills get weight 1.4 for target ratings up to 1600. New local findings use weight 1; this is an aggregation weight, not 100% confidence or a measured probability.

Up to 30 recent SRS recalls contribute failure and slow-response weights. Up to 30 completed lesson attempts add a bounded 0.25 x failure fraction. Five or more clean SRS recalls reduce priority by 20%; the UI calls this improving retention, not proven chess mastery. Recurring evidence sorts ahead of provisional evidence. Default recurrence needs two independent games.

Related skills group by controlled taxonomy category. Up to COURSE_MAX_UNITS groups become units; a mixed unit is added when multiple groups exist. Its initial selection alternates source groups instead of taking only the newest dominant skill. Within groups, selection alternates games and deduplicates canonical board positions.

## Archived course implementation (historical behavior)

Refresh keeps the active course ID and stable group units. New evidence updates rationale and priority, while existing ordered lesson items stay fixed. Inactive units keep their earlier records. Legacy manual stage marks are preserved where a unit is reused, but a new Check is still required before graduation. Older units without a sequence are shown as earlier stage records, not clickable lessons.

Immutable course revisions record target, groups, priorities, supporting decisions and evidence/run mappings. These snapshots remain in backups; the app no longer exposes course updates. A snapshot is added only when its content changes. After completing a sequence, new distinct supporting positions can start another sequence in the same unit; previous lessons and attempts remain saved.

## Lesson state machine

| Stage | Completion rule |
|---|---|
| Diagnose | Resolve up to two cold positions; misses/reveals count as diagnostic attempts |
| Teach | Study and acknowledge up to three verified examples |
| Drill | Resolve up to five practice positions; retries preserve first failure |
| Check | Resolve up to three positions and meet the configured first-attempt success fraction |
| Retain | Automatic after passing Check; selected positions become eligible for SRS |

Default selection is up to eight distinct positions. At six or more examples, reserve up to three separate check positions; otherwise the UI explicitly says some checks repeat taught examples. The check threshold defaults to 0.8, rounded up to a whole number of correct answers. A failed round keeps its sessions/attempts and starts another round. It does not grant completion because the learner eventually found the answers.

The backend enforces current stage and item order. The old manual-completion endpoint rejects attempts to bypass progression. A unit URL resumes its saved position after reload. Cold player responses omit the unit's title, skills and source evidence until teaching/completion. Lesson moves use the same legal validation, saved answer policy and engine verification as Review.

## Saved teaching examples

Existing lessons retain deterministic checklists and sound/played engine-line playback. Model summary generation and its UI have been removed. Historical TeachingRun records remain available through audit endpoints and backups, but no model-written summaries are generated or displayed in current lessons.

## SRS handoff

Lesson sessions and raw attempts persist, but never add FSRS reviews or change existing schedules. Only selected, previously unreviewed cards without an open Review session are withheld for course graduation. Reviewed cards and unfinished reviews stay available. Unselected/unclassified game exercises and curated exercises keep ordinary review behavior.

Passing Check releases the unit's cards without resetting existing FSRS history or fabricating a successful recall. New released cards may be immediately due for their first spaced-review event. Withheld cards are released if their supporting active units are retired. Related units may share a position; graduation in one is sufficient to release it.


## Active focused practice

Weaknesses now separates outcome groups from supported tactical mechanisms, shows distinct positions/game diversity, and exposes every supporting example. Foundational weighting also covers material_loss, missed_material_gain, allowed_mate and missed_mate. No mastery probability is displayed.

A skill can start up to 12 distinct nonretired, eligible game positions. Selection rotates through source games; within a game it favors positions with more recorded lapses, then recent evidence. Different decision records with the same legal position key appear only once per batch. First-failure/reveal history and response time are saved separately from ordinary reviews. Recent focused clean/failure counts are displayed, but do not act as evidence of blind recall or alter FSRS. The batch is held in the browser; reopening a skill may deliberately repeat practice, while its unfinished attempt resumes. Lessons and course generation remain archived.
