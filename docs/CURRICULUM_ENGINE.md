# Curriculum engine

Taxonomy v1 in taxonomy.py contains controlled tactical, opening/development, material/conversion, pawn, endgame and decision-making IDs, plus unclassified. Stable IDs and taxonomy versioning prevent vocabulary drift.

The official OpenAI SDK parses a strict Pydantic response: decision ID, known primary/secondary skills, confidence and explanation. Unsupported IDs, unrelated evidence IDs, malformed output, refusal and provider failure cannot create evidence. Confidence below configurable 0.7 creates no asserted skill link. Model teaching interpretations are visibly labeled and cannot alter legal moves, scores or accepted answers.

Audits retain model, prompt/schema version, decision/evidence linkage, cache identity, structured output, confidence, timestamp, application attempts and available token counts. The SDK has a 30-second timeout and at most two transport retries; these low-level retries are not separate application attempts. Successful low-confidence results are cached too. No live calls occur without explicit configuration.

## Priorities
Independence means distinct game IDs. Per game, count the maximum classification-confidence × bounded-severity × recency contribution. Severity caps at 3; mate transitions are 3; ordinary losses scale by 150 cp. Recency has a 90-day half-life using analysis timestamp, not historical game date.

Foundational skills receive 1.4 weight for target ratings <=1600. Up to 30 recent linked reviews contribute failure and slow-answer weights; five clean reviews reduce priority 20%. Sort recurring evidence before provisional examples, then by priority. This is an ordering heuristic, not an Elo conversion, probability or scientific mastery score. UI displays evidence/review counts rather than mastery percentages.

Default recurrence requires two independent games. A single example supports explicitly exploratory practice, never a claim of recurring weakness.

## Courses
Deterministic generation selects up to six priorities and archives prior courses. Every unit has relational links to actual evidence and a concrete rationale. Titles derive from controlled skill names. LLM-created ordering is unnecessary initially: the model supplies classification and per-example explanations only.

Each unit persists diagnose, teach, drill and retain stages. Practice opens a cold board; Teach opens engine evidence, labeled explanation and audit. Exercises come from supporting games, never generated positions. Stage completion is user-marked in this basic scaffold, not automatically asserted mastery. Richer sequencing and mixed-example lesson flow remain future work.

Meaningful decisions create practice even without classification, preserving utility offline. Exercises enroll in FSRS immediately in this version; teaching-gated graduation is a clean future policy extension. Repertoire/manual sources are separate from weakness diagnosis.

Cancellation preserves every committed classification and skill link; a request already in flight can finish before the job stops. Retrying uses cached successful responses for identical evidence/model/prompt/schema/taxonomy, including low-confidence results; only absent/failed responses require requests. New-game imports do not resume old cancelled jobs. Duplicate-only imports leave the current course untouched. An interrupted job may require completion or an explicit course rebuild to reflect its latest saved evidence in course units.

Classification uses its own bounded pool (`LLM_WORKERS`) independently of game-analysis workers. Each request still represents one verified decision and retains its own audit/cache identity. Cancellation saves in-flight responses and skips queued calls; later retries reuse completed records.
