# Weakness priorities and archived curriculum

The active product organizes recurring weaknesses and focused practice. Lessons, course generation and curriculum navigation are removed. The filename is retained for existing documentation links; the earlier course design is preserved in [archive/COURSE_DESIGN.md](archive/COURSE_DESIGN.md).

## Evidence and classification

The latest successful local rule run determines active SkillEvidence. ClassificationRun preserves current and historical responses with provider/version provenance. Failed or malformed runs preserve current labels; a successful abstention removes earlier asserted labels. Cached runs restore the matching projection without recomputation.

The learner can reject unsupported findings through an audit. Rejected responses remain saved but inactive; identical rejected rule/evidence/configuration results are not automatically revived. Objective analysis, accepted answers and review history remain unchanged. Old model evidence is inactive, with audits retained.

Outcomes and mechanisms use controlled IDs. Local findings carry aggregation weights, not measured probabilities. See [LOCAL_CLASSIFICATION.md](LOCAL_CLASSIFICATION.md) for current taxonomy and evidence gates.

## Current priority calculation

The live Weaknesses route calls priorities() in weaknesses.py. It uses these explicit heuristics:

1. Independence means distinct game IDs. Each game contributes its maximum evidence weight multiplied by bounded severity and recency.
2. Mate transitions have severity 3. Ordinary loss scales by 150 cp, capped at 3. Recency halves over 90 days using decision analysis time, not the historical game's date.
3. Listed foundational skills receive a 1.4 multiplier for target ratings up to 1600. This is a pedagogical preference, not an Elo-to-centipawn conversion.
4. Up to 30 recent ordinary SRS recalls add failure and slow-response fractions: multiply by 1 + failure fraction + 0.2 times slow fraction.
5. For compatibility, up to 30 completed **historical lesson attempts** still contribute a bounded multiplier of 1 + 0.25 times their failure fraction. New lesson attempts cannot be created by the app.
6. Five or more recent SRS recalls with no failures reduce priority by 20%. The label is improving retention, not proven chess mastery.

New local evidence uses weight 1. Recurring groups sort before provisional groups; default recurrence requires two independent games. The priority is rounded to one decimal and used for ordering, not presented as a scientific mastery score. Supporting evidence and decision IDs remain available for audit.

Focused attempts have separate recent attempt/failure counts. They do not change the ordinary recall fractions above or become evidence of blind recall.

## Focused practice

Weaknesses separates outcomes from supported tactical mechanisms, displays distinct positions and game diversity, and exposes all supporting examples. Choosing a skill selects up to 12 distinct nonretired, eligible game positions.

Selection rotates through source games. Within a game it favors more recorded lapses, then recent evidence. Different decisions with the same legal-position key appear once per batch. The batch lives in the browser; reopening a skill may deliberately repeat practice while resuming an unfinished attempt.

First-failure/reveal history, raw first-response time and completion time are persisted separately from ordinary reviews. Focused practice shares grading and playback with Review but never changes FSRS. See [SRS.md](SRS.md).

## Archived compatibility

Course grouping, Diagnose/Teach/Drill/Check/Retain stages, revisions and lesson progress remain in domain helpers and historical tables. They are not active workflows. Imports and classification do not build courses or withhold new cards. Course/lesson product routes return HTTP 410, and old lesson review sessions cannot accept moves or reveals.

Migration d17b63e02a48 released nonretired lesson-held cards by changing eligibility only. Schedules, attempts, reviews, retirement and lesson records were preserved. Teaching-generation routes and retries return 410; historical teaching audit reads/rejections remain available. Backups include the archived records.

A future curriculum redesign requires separate product work. Current priorities and focused practice do not imply that lesson generation has been re-enabled.
