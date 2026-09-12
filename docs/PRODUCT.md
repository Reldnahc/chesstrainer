# Product

This document describes the intended product. For implemented behavior and remaining gaps against the original specification, see [FEATURE_STATUS.md](FEATURE_STATUS.md). Course stages currently form a basic scaffold; their presence does not imply complete adaptive teaching or automatic graduation.

A private, local-first chess curriculum engine: real games → verified decisions → recurring skill evidence → courses → position practice → FSRS retention. Defaults serve a beginner progressing toward 1500 rapid. Practical sound moves are accepted; tiny engine preferences are not diagnoses.

Python-chess owns rules. Native local Stockfish owns evaluation. Deterministic code owns provable board facts. An optional OpenAI classifier labels verified evidence, never chooses moves or creates chess truth. Curated repertoire moves have their own authority.

Primary surfaces: Review, Course, Import, Weaknesses, Repertoire, Settings. Review hides source, concept, history, scores and answers until completion/reveal. Courses have diagnose, teach, drill and retain stages. A single mistake may create practice, but does not establish a recurring weakness.

No accounts, cloud database, social features, synthetic positions or public hosting. Data lives in SQLite on the host. Explicit Chess.com username imports retrieve public completed games; deliberately enabled structured classification sends verified evidence to OpenAI. Missing OpenAI must never prevent import, engine analysis or existing reviews.

Initial acceptance target: import a learner-identified PGN; analyze local Stockfish evidence; classify through an injected mock or configured OpenAI adapter; build an evidence-linked unit; solve a backend-graded exercise; persist one FSRS recall event; reload successfully. Subsequent milestones extend this slice without compromising chess correctness.
