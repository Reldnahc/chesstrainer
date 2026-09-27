# Verification status

The repeatable procedure is in [TESTING.md](TESTING.md). Prior passes remain below with their original scope and results.

## Mobile SRS spacing: September 27, 2026

The shared workspace collapses its unused board toolbar on phones. SRS no longer
has a 54px empty strip before the coach; game-review navigation and shared desktop
board sizing remain intact.

- Production build and API/TypeScript checks passed.
- Presentation browser tests: **5 passed, 1 expected mobile skip**, including
  matching desktop board geometry and tight SRS spacing at 390px and 375px widths.
- Manually inspected the real SRS page at 390px before and after the fix.
- Windows left the isolated test server running after assertions completed;
  terminating only that fixture process let the test runner exit successfully.

## Selectable coach release: September 27, 2026

All 16 characters are available in Settings and use the shared reaction system
in game review, SRS practice and saved explanations. The studio and production
registry now derive their characters from one catalogue. Existing accounts retain
Storyteller; individual IDs and motion preferences follow the account to another
device. The existing preference table needs no further schema change.

- Full backend suite: **440 passed**, including restart persistence for every
  coach, defaults, account isolation and rejected invalid choices. The two
  existing TestClient dependency deprecation warnings remain.
- Full desktop/mobile browser suite: **115 passed, 3 expected viewport skips**.
  Separate account suite: **2 passed**, including a blonde coach restored on a
  second device and an independent default for another account.
- The browser suite selects every API-allowed coach through Settings and loads
  it into an actual game review. It also checks the collie's SRS reactions,
  failed-save recovery, reduced motion, old bookmarks and studio behavior.
- Production build, generated API consistency, TypeScript contracts, Ruff lint
  and Python formatting passed. Docker install CI now saves a black-cat choice
  and checks it after restart in both local and account modes.
- Manually selected coaches in the application, inspected the collie beside
  a blunder explanation and Show why, and inspected phone-emulated Settings.
  Selection cards reserve their space and only the selected portrait idles.

The shared artwork is bundled with the application; the comparison interface
remains lazy-loaded. No external illustration requests, engine settings, proxy
settings or additional services are required.

## Expanded coach cast: September 27, 2026

The studio now offers 16 concepts: Storyteller plus three new men, four women
including a blonde coach, four cats including a solid-black cat, and two golden
retrievers alongside a corgi and a border collie. Storyteller remains the sole
production selection. Retired variants and their unused artwork were removed.

- Production build, generated API consistency and TypeScript contracts passed.
- Full desktop/mobile browser suite: **111 passed, 3 expected viewport skips**.
  Account suite: **2 passed**. Final beard-outline polish was followed by another
  successful build and **4 passing desktop/mobile human-collection checks**.
- Every concept is checked across all 20 expressions. Each performs brilliant
  and blunder entrances, supports an idle preview, and respects reduced motion.
  Tests also check stable geometry, real portrait widths, unique eye masks,
  cancellation on character switches, old/unknown URL fallbacks, no accidental
  classic-animation bleed into the new men, and no preview preference writes.
- Manually used the actual studio, compared reaction silhouettes, reviewed the
  new expression sheets, and inspected 92.8px/52.5px previews. Refined the collie's
  folded ear, the black cat's lip/eyelid contrast and dark paws, the new beards'
  edges, and comparison-button alignment. Mobile layout was checked in emulation.
- The studio artwork stays lazy-loaded: **15.59 KB JavaScript and 4.08 KB CSS
  gzipped** in the final build. These are asset sizes, not a device benchmark.
- Tail follow-up: the border collie's white tip now covers the gray fur contour,
  ending the line at the color boundary while retaining the original silhouette.
  Production build and both desktop/mobile dog-collection checks passed; the
  boundary was also inspected in the actual studio.

The artwork uses the existing lifecycle and semantic reactions. No backend,
database, account contract, or engine scheduling changes were required.

## Additional coach studies: September 27, 2026

The studio now compares a woman, cat and golden retriever, each with three visual
directions and 20 expressions, alongside the existing coach. Shared human artwork
was extracted first and verified against the original review behavior.

- Production build, generated API consistency and TypeScript contracts passed.
- Full desktop/mobile browser suite: **107 passed, 3 expected viewport skips**;
  separate account suite: **2 passed**. Desktop checks accept browser subpixel
  rounding; animation assertions first bring the portrait onscreen, matching the
  visibility contract.
- New tests cover all nine expression collections, finite reactions, species
  idle gestures, unique eye masks, reduced motion, stable comparison geometry,
  actual review portrait widths, URL restoration and safe character switching.
  Preview navigation performs no API writes and Settings keeps one real choice.
- Inspected each new character's brilliant and blunder comparisons in the actual
  application, expression sheets and the 92.8px/52.5px review previews. Quiet and
  playful studies use different timing tracks and poses. Worried tails now tuck
  toward the hip instead of extending beyond the portrait; cat ear flicks include
  a small, finite whisker movement. Mobile checks use browser emulation.

The additional artwork remains in the lazy studio chunk. Production coach
selection, account data and engine scheduling are unchanged.
The complete studio chunk is 12.31 KB JavaScript and 4.03 KB CSS gzipped, measured
from the production build; this is an asset-size check, not a device benchmark.

## Animated coach: September 27, 2026

Completed after the code-quality audit and deletion of its temporary checklist.
The shared coach now has 20 semantic states and three complete concept families,
with Storyteller used in game review, SRS and saved explanations. Settings owns the
selected coach and motion preference through the existing account database. See
[COACH.md](COACH.md) for the design decisions, lifecycle and extension contract.

Final verification:

- Backend/native/API suite: **424 passed**, with the two existing TestClient
  dependency deprecation warnings.
- Desktop/mobile browser suite: **99 passed, 3 expected viewport-specific skips**;
  separate account suite: **2 passed**. Includes semantic mapping, fallback cycles,
  recovery, replay, offscreen handling, stale engine responses, reduced motion,
  preference load/save failure recovery, LAN reconnection and second-device state.
- Ruff lint and formatting, exported OpenAPI consistency, generated TypeScript,
  contract rejection checks and the production build passed.
- Fresh Alembic upgrade and schema check passed. Migration tests preserve existing
  users and foreign keys; missing preferences read safely without creating rows.
- A Docker image built from the public source archive passed fresh local/account
  installation, native Stockfish game review, health checks and restart. Coach
  preferences persisted in both modes using the existing data volume.
- Manually used the production frontend and native engine with isolated synthetic
  fixtures: game navigation through blunder/checkmate, wrong SRS move, retry,
  successful recovery, explanation playback, Settings save/reload, all three
  concept collections, transition playback and idle previews. Inspected 1366px
  and 1440px desktop views, 390px phone layout, and the actual 92.8px/52.5px
  portrait sizes. Mobile checks use browser emulation, not a physical handset.

The review produced concrete fixes: mobile controls no longer overlap; replay
restarts the SVG even mid-reaction; returning onscreen does not replay an already
seen entrance; known move feedback does not briefly flash a neutral face; terminal
coaching describes the learner's outcome; per-instance eye masks contain glances;
and optional LAN login automatically retries preference loading. Artwork styles
are scoped to their registered coach. Studio panels were separated by purpose,
and no unused/undefined animation tracks or temporary production coaches remain.

Shared board and speech-bubble geometry stayed unchanged. The runtime uses finite
CSS/SVG animations and occasional local timers, with no JavaScript frame loop.
The studio is a separate lazy-loaded chunk (4.42 KB JavaScript and 2.06 KB CSS,
gzipped); production JavaScript grew by approximately 8.1 KB gzipped over the
pre-feature build. This is an asset-size check, not a device performance benchmark.
No blocking finding remains from this feature review.

## Completed code quality audit: September 27, 2026

All ten audit findings are resolved. The final review revisited the first four
fixes as well as the remaining six before removing the temporary checklist.
No blocking finding remains from this review.

1. **Publishing checks:** Docker publication requires the reusable correctness
   workflow for the same commit, including manual releases. Reviewed dependencies,
   checkout SHAs, permissions and immutable image tags; no unchecked release path
   was found.
2. **Shared hosting:** One application and bounded host-wide workers replace
   per-account runtimes. Reviewed account-scoped queries, job ownership, recovery,
   cancellation, pooled session rebinding and shutdown. Regressions cover 250 idle
   accounts, concurrent isolation and shared engine limits.
3. **Review structure:** Session, playback, navigation and engine-request state
   have separate owners; both review screens retain shared presentation. Reviewed
   cleanup and generation checks that prevent late responses from replacing a
   new session or selected move.
4. **API contracts:** Runtime response schemas and generated endpoint-specific
   frontend types replace duplicated payload definitions. Checked export/type
   drift, invalid-call regressions and rejection of malformed responses.
5. **Account CI:** Local and account browser suites are independent required
   matrix jobs, with separate trace directories. Signup, second-device login and
   private-library behavior are covered on desktop and mobile.
6. **CSS ownership:** Shared board/coach/layout rules and feature styles have
   explicit owners; obsolete selectors and repeated overrides were removed.
   Sampled computed styles matched before/after across seven screens and five
   widths; visual inspection and browser geometry/motion checks passed.
7. **Tactical rules:** Named motif rules and classification stages replace the
   oversized methods. Reviewed outcome admission, rule ordering and provenance;
   all 70 complete fixture classifications matched the previous implementation
   in a differential comparison. Pinned upstream code remains unchanged.
8. **Chess helpers:** Legal-move serialization and tactical witness construction
   share their owning modules. Special-move tests preserve castling, promotions,
   en passant and the deliberate SRS/game-over policy distinction.
9. **Archived lessons:** Removed inactive generation/progression and the review
   dependency cycle. Reviewed direct-call guards, historical audit access and
   unchanged archive rows. Three obsolete lesson settings were removed; historical
   models and migrations remain intact.
10. **Diagnostics:** Health reports the last observed engine result, including an
    unchecked state for lazy startup. Reviewed failure/recovery, pooled ownership
    and reference-mismatch handling. Tracebacks remain in server logs while
    unexpected client errors are sanitized; UI retries remain available.

The final pass found a verification gap: the Docker smoke test launched Stockfish
separately without exercising the app's worker. It now imports a synthetic game,
completes a native review through HTTP and checks engine health in both modes.
Testing documentation was also corrected to describe the removed lesson helpers
and the current five navigation destinations.

Final verification of the completed implementation:

- Backend/native/API suite: **419 passed**, with two existing TestClient dependency
  deprecation warnings.
- Desktop/mobile browser suite: **77 passed, 3 expected viewport-specific skips**;
  separate account suite: **2 passed**.
- Production frontend build, API export/generated-type checks, compile-only type
  regressions, repository Ruff lint/format, Actionlint 1.7.12 and Git whitespace
  checks passed.
- A fresh isolated database upgraded to the current Alembic head with no schema
  drift. No schema change was needed for the audit fixes.
- Local image `fieldwork:audit-final` built from the public-source snapshot and
  passed fresh-install, restart, native game-review and engine-health checks in
  both local and account modes. Its disposable containers and data volumes were
  removed afterward.

No active Docker variable was added or changed. Removed legacy lesson settings
are documented in [CONFIGURATION.md](CONFIGURATION.md); old environment entries
are ignored. The engine-health API now distinguishes unchecked availability with
`null`, and the frontend handles that state explicitly.

These results cover the local implementation and configuration review. Live
GitHub Actions execution awaits a requested push. No image was published, no live
database was modified and no Unraid deployment was performed.

## Audit fixes 1, 3 and 4: September 27, 2026

- Docker publishing now depends on the reusable correctness workflow for the same
  commit. Actionlint 1.7.12 passed; live GitHub Actions execution awaits a requested
  push.
- Review session, playback, navigation and analysis state are separated from
  presentation while retaining shared board/coach/layout components. Browser
  regressions cover unchanged geometry, motion, branching and stale responses.
- Active API success responses have runtime schemas; the frontend uses generated
  OpenAPI types and endpoint-specific requests. Export drift, generated-type drift
  and invalid-call type checks passed. A malformed response regression confirms
  server-side validation rejects an incompatible payload.
- Final full backend suite: **411 passed**, with two existing TestClient dependency
  deprecation warnings. Final ordinary browser suite: **75 passed, 3 expected
  viewport skips**. Separate desktop/mobile account suite: **2 passed**.
- Production frontend build, unused TypeScript symbol checks, repository-wide
  Ruff lint/format and Git whitespace checks passed.
- Docker Desktop built `fieldwork:audit-contracts` from the staged public-source
  snapshot. Fresh installs, persisted restarts and native Stockfish passed in
  local and account modes using disposable containers and anonymous data volumes.
  The snapshot avoided a Windows ACL error while Docker walked the ignored
  `.pytest_cache`; Docker's public-file allowlist still applied to the build.

No database schema, container variables or chess/SRS policy changed. No live
database, Unraid deployment or published image was modified. Account browser
checks were still a separate local invocation at this milestone; the completed
audit review above records their subsequent inclusion in CI and the remaining
fixes.

## Game-review UX: September 26, 2026

- Targeted backend/native review suite: **26 passed**, including current-board
  mate, fork, pin and capture cues, rejecting late witness overlays, saved reports,
  manual variations and practice isolation.
- Game-review browser suite: **8 passed** across desktop and phone Chromium.
  Checks stable coach/notation geometry through short and long messages, errors
  and explanations; graph width at 360–1920px; source-game preservation; manual
  branching and queued ratings; and explanation dismissal without a move tree.
- Shared-board regression subset: **8 passed** for promotion/dragging, legal
  capture markers, cold-review explanation playback and focused-practice cues.
- TypeScript/Vite build and targeted Ruff checks pass. Desktop and phone layouts
  were also inspected in the local browser using a disposable synthetic game.
- Existing reviews derive their annotations when read; no migration or bulk
  reanalysis is required. This pass does not publish or deploy the new image.

One initial phone geometry assertion compared viewport coordinates across an
intentional browser scroll; it now compares document coordinates. Sandboxed
Windows runs required stopping their isolated test server after the tests ended;
host-permission runs clean up normally. Existing TestClient and terminal-color
deprecation warnings remain.

## Full-game review: September 25, 2026

- Full backend/native/API suite: **293 passed**, including both-color reports,
  independent practice history, saved review reopening without an engine, cancel/resume,
  setup positions, promotion, en passant, castling, typed mate scores, Great criteria,
  Elo-only Blunder severity, positive fork evidence and a mating queen sacrifice.
- Full Playwright suite: **43 passed, 1 intentional skip** across desktop and phone
  Chromium. Includes coach playback, legal variation branching, undo/return, source
  game preservation, viewport fit and rejection of late analysis responses.
- TypeScript/Vite build and repository-wide Ruff lint/format checks passed.
- Fresh Alembic migration to **04af728d913e** matches SQLAlchemy metadata with no drift.
  The migration adds independent game-review tables; training tables are unchanged.
- The dated recall-restart fixture now starts at the real initialization time used by
  FSRS instead of leaving untouched cards in the future relative to a frozen past clock.

Review rules and conservative evidence limits are documented in [GAME_REVIEW.md](GAME_REVIEW.md).
Tests use isolated databases and synthetic positions. Private games, generated reports,
native engines and test screenshots remain uncommitted. No live database migration,
server restart, public deployment or bulk reanalysis was performed. Start the application
normally to apply the additive migration and use **Games**.

Existing TestClient deprecation and terminal-color warnings remain. Expected provider
error fixtures still log `job_failed`; these are not test failures. The initial browser
run required updating the old four-tab navigation assertion to five. Browser tests run
with host process permissions so Playwright can tear down its isolated Windows server.

## Pinned Lichess integration: September 13, 2026

| Check | Result |
|---|---|
| Upstream predicate/source parity | 19 deterministic tests; every original function AST preserved after removing observers; supporting files/license match original hashes |
| Full frozen upstream output parity | All 12,000 theme sets match unmodified upstream; 17,468 valid witness records |
| Final frozen comparison | 12,000 incidences, zero reconstruction skips; per-theme raw/admitted results and limits in LICHESS_REUSE.md |
| Full backend/native/API suite | **280 passed**, no skips, 26.05 seconds; Stockfish 18 |
| Full Playwright suite | **39 passed, 1 intentional skip**, 49.3 seconds; desktop and phone-emulated Chromium |
| TypeScript / Vite build | Passed, including the local public-source archive |
| Ruff | Repository-wide lint and format checks passed; original vendored source intentionally excluded |
| Fresh and copied Alembic verification | Head f83a90d16c24; no schema drift; all copied rows/schema unchanged across 30 tables |
| SQLite integrity | Both databases ok; zero foreign-key violations |
| Documentation and source ZIP | Local Markdown file links resolve; archive integrity and public-file/license inclusion verified |
| Git whitespace | Passed |

Existing classifier and wrong-label regression assertions were retained. New pin-exploitation cases pass for both colors; a raw double-check observation does not assert a mistake without meaningful engine evidence. No grading, native engine, FSRS or schema logic changed. Two older migration imports were reordered for repository-wide Ruff.

Browser verification caught and fixed a real regression: extra motif buttons could push the return control below a short phone viewport. Return and motif actions now share a compact wrapping row below the board/playback controls, preserving board/header geometry and focused-practice reachability. Existing viewport assertions remain intact. The new download assertion accepts the two platform ZIP MIME types and still checks successful HTTP delivery and ZIP content.

The first browser invocation lacked the installed Chromium path; the final complete run used .tools/playwright through PLAYWRIGHT_BROWSERS_PATH. The source build now selects the checkout virtual environment instead of the broken Windows python alias, with SOURCE_PYTHON override. Two existing TestClient deprecation warnings, terminal-color warnings and expected provider-failure fixture logs remain unsuppressed.

Tests use isolated databases. Migration preservation uses SQLite online backup from a read-only live connection; only the copy was migrated. Source archives exclude private data, secrets and untracked files. No LLM runtime or network dependency was added. Native grading and recall histories remain protected by the full regression suite.

The complete frozen comparison is a partly generator-related compatibility measurement, not independent classifier precision. Remaining gaps and private failure corpora are documented in LICHESS_REUSE.md. Physical-phone and cross-platform install checks remain separate from emulation.

Deployment: restarted the idle LAN backend at 192.168.1.12:8000 after committing the verified code. Health reports Stockfish 18 and classifier 4.0-lichess-8d9faff6. Before/after fingerprints confirm unchanged games, decisions, exercises, accepted answers, review sessions, reviews and SRS states. No bulk reclassification was run; Settings > Classify saved games applies the new version to saved evidence without new engine analysis.

## Lichess benchmark tooling: September 13, 2026

| Check | Result |
|---|---|
| Deterministic benchmark suite | **48 passed**, 0.26 seconds; all optional Zstandard tests ran |
| Full backend/native/API suite | **245 passed**, no skips, 25.28 seconds |
| Ruff lint | Passed for backend and scripts |
| Ruff formatting | Passed for backend, scripts and migrations; 99 files |
| External dataset run | Complete scan of 6,100,952 rows; 1,000 positives per 12 eligible mappings; 12,000 reconstructed incidences, zero skips, 2,260 disagreements |
| Corpus consistency | Counts match metrics; every exported witness move/actor/frame matches solver coordinates; 11,978 unique puzzle IDs |
| Production scope | No changes to trainer runtime, frontend, classifier rules, engine/grading/FSRS, schema, migrations or production dependency locks |

See the [benchmark guide](LICHESS_BENCHMARK.md) and [measured baseline](LICHESS_BENCHMARK_RESULTS.md). The dataset and complete reports/corpora stay under ignored data/lichess-benchmark. The run used Python 3.12, native application tests used the existing Stockfish 18, and the optional offline decoder was zstandard 0.25.0. Benchmark runs themselves use no engine, database, server or network.

Two existing upstream TestClient deprecation warnings remain; neither was suppressed. Fresh workspace basetemp/cache paths avoided Windows shared temporary-directory access problems. Tests and the benchmark did not restart the LAN application or change live data.

This developer-only pass did not rebuild or rerun the unchanged frontend or repeat manual fresh/copied migration verification. Those checks passed immediately before it, as preserved below; migration-related backend regressions still run in the full suite.

These are positive-theme line-detector measurements, not precision from absent tags or full-classifier accuracy. No rule was tuned against benchmark failures.

## Previous pass: interface ownership and documentation

Completed September 13, 2026 for the focused interface refactor and documentation-consistency pass. The repeatable procedure is in [TESTING.md](TESTING.md); previous milestone/deployment results are in [IMPLEMENTATION_HISTORY.md](IMPLEMENTATION_HISTORY.md).

### Results

| Check | Result |
|---|---|
| Full backend/native/API suite | **197 passed**, no skips, 25.56 seconds |
| Full Playwright suite | **39 passed, 1 intentional skip**, 50.6 seconds; desktop and phone-emulated Chromium |
| TypeScript / Vite production build | Passed; final type-only correction produced the same runtime bundle |
| Ruff lint | Passed for backend and scripts |
| Ruff formatting | Passed for backend, scripts and migrations; 86 files |
| Fresh Alembic chain | Upgrade to f83a90d16c24 passed |
| Alembic schema drift | No new operations for fresh and copied databases |
| Copied-data preservation | All rows and schema unchanged across 30 tables, including alembic_version |
| SQLite validation | Integrity ok and zero foreign-key violations on fresh and copied databases |
| Documentation | Local files/headings resolve; complete original roadmap journal and course design preserved |
| Git whitespace | Passed |

The browser skip is the desktop instance of a test specifically for short phone viewports; that test passes in the mobile project. No test was weakened or removed.

Backend verification used fresh basetemp/cache_dir paths under ignored data to avoid Windows shared temporary-directory permissions. Native tests used Stockfish 18. The environment was Windows, Python 3.12 and Node 24.19; dependencies remain pinned by requirements.lock and frontend/package-lock.json.

Two existing upstream TestClient warnings remain: Starlette's httpx integration deprecation and AnyIO's BlockingPortal alias deprecation. Browser runner output also includes the existing terminal-color environment warning and expected job-failure logs from provider-error fixtures. These did not cause failures.

### Behavior preservation

The recorded pre-refactor OpenAPI contract covers 24 documented API paths, their methods, operation IDs, validation schemas and responses. A new regression compares that contract, and another verifies independent resources/access controls for two application instances.

All 34 original endpoint/helper/lifespan bodies matched by Python AST after extraction. All nine original frontend component/helper bodies retained compiled equivalence; the comparison joined adjacent React text children introduced by formatting. Existing browser regressions verify board identity, timing, geometry, focus, failure/reveal and persistence.

The refactor changes interface ownership only. Classifier, Stockfish, grading, FSRS, schemas and migrations are unchanged. The complete backend suite includes the native import-analysis-classification-exercise-review-restart flow and historical compatibility tests.

### Data and deployment scope

Migration validation used SQLite's online backup API to obtain a consistent copy, opening the live source read-only. Only fresh/copied databases were migrated; private verification artifacts stay under ignored data/code-health-20260913. Browser and API tests used isolated fixtures and did not submit reviews or analysis jobs to live data.

The production frontend was rebuilt. The running LAN backend was not restarted as part of this maintenance pass; it will load the extracted routers on its next normal restart. Binding and host configuration were unchanged.

Six current public screenshots were refreshed from inspected Playwright fixture captures; older images are explicitly historical in [screenshots/README.md](screenshots/README.md).

### Limits and deferred code health

- Review.tsx still contains a substantial related state/timer flow. A state-machine rewrite would require a separate interaction-focused task.
- Older frontend API payloads still include loose types and the generic client's any default. This pass typed the newly separated health/settings/import boundaries without introducing generated contracts.
- Some HTTP/domain queries still repeat lookups. Query optimization was left unchanged.
- curriculum.py still combines live weakness priorities with archived course helpers. Splitting domain responsibilities is outside this interface-only pass.
- Dependency upgrades to resolve upstream warnings, standalone wheel/static packaging, manual Linux/macOS installation and physical-phone LAN checks remain separate work.

Passing suites do not establish independent classifier accuracy or long-term chess improvement. No classifier rules or quality measurements were changed; see [CLASSIFICATION_ASSESSMENT.md](CLASSIFICATION_ASSESSMENT.md) for the existing assessment and its limits.
# Shared hosting verification — September 26, 2026

- Full backend suite: 298 passed; subsequent populated-database ownership migration
  test passed as part of the four-test account suite (299 backend tests now present).
- Ruff lint and format checks passed. TypeScript/Vite production build passed.
- Existing Playwright suite: 43 passed, one intentional desktop skip. Additional
  account suite: two passed, covering desktop and mobile and a second device.
- Docker image built from a public-source export because a local Windows cache ACL
  prevented Docker's context walker from reading the original checkout. Compose
  configuration validated with a placeholder public origin.
- Running non-root Linux image used native Stockfish 17.1. Synthetic smoke checks
  verified source download, signup, private libraries, fetch-only PGN imports,
  completed whole-game review, selected-game training, retained session/review
  after container restart, healthy container status, and a consistent SQLite
  backup restored with both accounts and foreign-key-safe application data.
- Tests used temporary databases/containers only. The user's real database has not
  been migrated and the Unraid deployment/proxy have not been changed.

## Game-review UX verification - September 26, 2026

- TypeScript/Vite production build passed.
- Full browser suite: 45 passed, one intentional desktop skip. After final
  presentation refinements, all six review-specific desktop/mobile tests passed.
- Browser checks cover 1366x768 board/timeline fit, visible move-quality markers,
  actual 280 ms piece transitions, reduced-motion feedback, short previews from
  deliberately long engine output, exact return anchors, nested variations,
  asynchronous ratings for rapid moves even after returning to the game,
  stale-response isolation, retryable engine errors and unchanged saved games.
- Desktop and phone screenshots were visually inspected. Shared-board training,
  legal moves, promotions and dragging passed the full browser suite.
- No engine classification policy, database schema or hosting configuration changed.

## PGN ratings and completed-review controls

- All 20 backend game-review tests passed, including distinct PGN ratings for
  White/Black in saved reports and interactive variations, plus invalid/missing
  Elo handling without borrowing the opponent's rating.
- All six desktop/mobile review browser tests passed; completed reviews have
  neither a Game report heading nor an Update labels action.
- Production build, targeted Ruff checks and git diff whitespace checks passed.

## Board-first desktop layout

Production build and all six review browser tests passed. At 1366x768 the board
is over 580px square, begins within 110px of the screen top, and its controls fit
in the viewport. Widening to 1600px grows the sidebar while preserving board size;
increasing height to 900px grows the board. The evaluation chart remains available
in the right panel. Desktop screenshot inspected; mobile review tests also pass.

## Browser navigation - September 26, 2026

- TypeScript/Vite production build passed.
- Full Chromium desktop/phone UI suite: 56 passed, two intentional device-specific
  skips. Account suite: two passed, including login directly into a bookmarked
  game/move and rejecting that same game URL for a different account.
- Checks cover Back/Forward through screens and game reviews, refresh/direct
  paths, modifier-click opening a separate tab, active-link history deduplication,
  selected-move restoration without per-move history entries, paginated library
  scroll restoration, invalid/missing links, legacy exercise/unit links and
  focused-practice history. Existing training and game-review interactions pass.
- Desktop review and phone library screenshots were visually inspected. The
  shared compact header and board layout remain intact.
- Tests used isolated fixture databases. No database schema, engine policy,
  reverse-proxy configuration or running Unraid deployment changed.

## Automatic game reviews and faster progress - September 26, 2026

Opening a game now starts or resumes its review once. Completed reports are reused;
pause remains paused while the game stays open, and failures expose an explicit
retry. Parallel move searches keep full repetition history and commit in game order
so Great-move comparisons retain the preceding score. Progress returns only new
display reports, and mainline browsing avoids duplicate interactive searches while
the review runs. Manually played variations still receive analysis.

A local native-Stockfish benchmark used a synthetic 24-ply Ruy Lopez game, a fresh
empty database for each run, depth 16, a 0.8-second search cap, one engine thread,
64 MB hash per engine and no node cap:

| Review implementation | Workers | Elapsed time |
| --- | --- | --- |
| Previous sequential loop | 4 configured, 1 used | 10.000 s |
| Bounded parallel implementation | 1 | 10.077 s |
| Bounded parallel implementation | 4 | 3.435 s |

The four-worker run was about 2.9 times faster in this single local benchmark;
this is not a universal latency guarantee. Per-position search limits and move
classification rules are unchanged. The default remains one worker; parallel
speedups require increasing `STOCKFISH_WORKERS` within the available engine budget.

The full game response was 299,991 bytes. Incremental progress with two new move
reports was 1,982 bytes, and a no-change response was 145 bytes. Polling is single
flight, waits 750 ms between responses, and advances its cursor by reports received
even if the job's completed count races ahead. Tests and benchmarks use isolated
databases; no schema migration or running Unraid deployment was changed.

- Full backend suite: 329 passed, including native one/three-worker reviews,
  pause/resume, out-of-order search completion, engine-budget enforcement,
  preserved repetition history, worker-failure cleanup, incremental reports and
  account isolation. The API snapshot includes the new progress route and optional
  fallback rating; no other contract changes were present.
- Full desktop/phone browser suite: 60 passed, two intentional device-specific
  skips. Separate account suite: two passed. New checks cover automatic startup,
  retry, pause/reopen, completed reuse, incremental ratings without board reloads,
  a racing progress count and avoiding duplicate original-position searches.
- TypeScript/Vite production build, targeted Ruff lint/format checks, Unraid XML
  parsing and Git whitespace checks passed.
