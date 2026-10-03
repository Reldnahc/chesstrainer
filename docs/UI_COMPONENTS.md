# UI component reuse and standardization

This is the component lookup and reuse policy for Fieldwork frontend work. Read
it before adding or changing UI. It records what exists today separately from
the [owner's standardization decisions](#owner-decision-record), so an agent must
not assume a planned component is already implemented. Keep this document current
when a reusable component is added, renamed, extended or retired.

## Rules for contributors and agents

1. **Look before building.** Search the inventory below and the existing consumers
   for the same user task. Check JSX, related CSS and responsive rules. Similar
   behavior with a different filename is still an existing implementation.
2. **Reuse the component, not a copied version of its markup.** Extend a suitable
   existing component with a small, meaningful variant or content slot. A future
   fix should reach all equivalent consumers. Do not add a page-specific copy or
   CSS override merely because it is quicker.
3. **Match semantics as well as appearance.** Destinations use `Link`; commands
   use buttons. URL section navigation, local tabs and form choices are distinct
   interactions. They may share visual tokens without sharing incorrect ARIA
   roles, keyboard behavior or persistence.
4. **Keep domain logic with its owner.** Shared UI receives values, content and
   callbacks. It must not absorb engine evaluation, move legality, grading,
   scheduling, imports, session commands or account persistence. Preserve cold
   practice's answer restrictions and the existing motion policies.
5. **Prefer small primitives and composition.** Do not build a universal card,
   form, player or selector with dozens of mode flags. Ordinary native HTML is
   fine when it already supplies the behavior. Extract repeated interaction,
   accessibility or layout policy; not every repeated `<p>` needs a component.
6. **Own styles with the shared component.** Put sizing, selection, focus, hover,
   disabled, busy and mobile behavior in one place. Express intentional density
   variants explicitly. Avoid selectors such as unscoped `nav` that make unrelated
   components inherit another component's layout.
7. **Preserve accessibility and interaction contracts.** Keep labels, description
   associations, keyboard focus, tab order, announcements and link modifiers.
   Loading or selection must not change control geometry unexpectedly. Moving
   JSX must not remount a coach, replay an animation or reset a user's draft.
8. **Respect entrypoint boundaries.** Application, coach studio, intelligence
   lab and audio studio have separate CSS/dependency boundaries. Reusing a small control must not
   pull application shells into development tools. Use the existing
   [style manifest](../frontend/scripts/style-boundaries.json) and guard; do not
   weaken it or broaden CI solely to accommodate a misplaced import. **The main
   application is canonical:** promote its components and presentation before
   versions from performance tools, coach studios or other development surfaces.
   Adapt tools to shared application primitives, retaining tool-specific behavior.
9. **Record justified differences.** If reuse is unsuitable, state the semantic
   reason and list the existing alternative here. Cosmetic preference alone is
   not a reason for two implementations of the same control.
10. **Verify every affected consumer.** Test the shared contract and representative
    desktop/mobile uses, including different busy/disabled states. Choose checks
    from [TESTING.md](TESTING.md) and the dependency boundaries; do not routinely
    run the full coach artwork matrix for application-only controls. Follow the
    owner's current verification instructions and record actual results.
11. **Draw symbols as icons.** Checks, arrows, stars and other pictographs use
    lucide icons, never characters such as U+2713 or U+2197: phones and some
    fonts draw those as colour emoji. `npm run test:symbols` (part of `build`)
    rejects emoji-capable characters, variation selectors and the arrow, shape
    and dingbat blocks in application and studio source.

## Existing reusable components

These are implemented now. CSS-only utilities are identified as such; they are
not React components.

| Job | Existing owner | Reuse contract |
| --- | --- | --- |
| Internal destination links | [Link](../frontend/src/Link.tsx), [navigation](../frontend/src/navigation.ts) | Normal anchors, modifier/new-tab clicks, history and scroll restoration. Do not implement another click-to-navigate wrapper. |
| URL section navigation | [SectionNavigation](../frontend/src/SectionNavigation.tsx), [section-navigation.css](../frontend/src/section-navigation.css) | Settings, Openings and Insights (Overview / Weaknesses) share the framed tray. The `compact` density is a second level inside a section (Weakness categories: Tactical patterns / Material & mate) and keeps the 44px targets with a narrower tray and selected style. Callers supply destinations, selected ID and accessible name; account/course/category filtering remains caller-owned. Weakness categories use bookmarkable query routes and reuse loaded evidence across category changes. |
| Local single choice | [ChoiceGroup](../frontend/src/ChoiceGroup.tsx), [choice-group.css](../frontend/src/choice-group.css) | PGN source, puzzle difficulty and Studio filters share rectangular pressed buttons. Controlled value/options/callback; no route or tab semantics. Caller owns input clearing and filtering. |
| Commands and button-styled destinations | [Button / IconButton](../frontend/src/Button.tsx), [ActionLink](../frontend/src/ActionLink.tsx), [action-controls.css](../frontend/src/action-controls.css) | Ordinary/compact sizing, primary/secondary/quiet variants, square labelled icons and 44px phone targets. Button defaults to type=button; forms must request submit. ActionLink retains Link semantics. Native disabled and aria-disabled stay independent. Containers own width/placement. |
| Return from exploration | [ReturnButton](../frontend/src/ReturnButton.tsx) | Canonical purple action and return icon for game variations and lesson branches/full games. Caller supplies label, disabled state and command; long labels can wrap on narrow phones. |
| Paged destinations | [Pagination](../frontend/src/Pagination.tsx) | Catalogue Previous/range/Next layout for Games and opening catalogue. Callers supply counts and destination URLs; unavailable directions are disabled buttons. |
| Resume/continue row | [ResumeLink](../frontend/src/ResumeLink.tsx) | Existing raised title/subtitle/arrow destination row for saved lessons, puzzles, course lines and Home's practice priorities. Callers supply destination and content; chapter commands remain separate. |
| Study statistics | [StatList](../frontend/src/StatList.tsx) | Shared definition-list markup and metric appearance for puzzles, opening studies, weakness cards and Home; callers supply labels/values and visibility. Featured prominence supports a primary dashboard count without page-specific number styles. Do not duplicate counts as page-specific statistic markup. |
| Move playback controls | [MovePlaybackControls](../frontend/src/MovePlaybackControls.tsx) | Labelled previous/counter/next group, optional first/last, stable digits and canonical lesson geometry. Callers own navigation and separate flip/back controls; disabled and aria-disabled remain independent. |
| Selectable continuation | [ContinuationMoves](../frontend/src/ContinuationMoves.tsx) | Start/SAN controls, optional move numbering, explicit selected occurrence and playback-disabled state. Callers own inspection; full-game scored notation stays separate. |
| Ordinary page heading | [PageTitle](../frontend/src/PageTitle.tsx) | Eyebrow, title and optional actions. Phones hide the eyebrow. Compact board-workspace headings remain a separate use case. |
| Settings section | [SettingsSection](../frontend/src/SettingsSection.tsx), [settings.css](../frontend/src/settings.css) | Labelled section, heading, optional description/actions and consistent spacing. Currently application/Settings-specific. |
| Board rendering and interaction | [Board](../frontend/src/Board.tsx), [board.css](../frontend/src/board.css) | Legal destination markers, tap/drag, promotion, highlights, piece motion and quality markers. Backend-supplied legality remains authoritative. |
| Native modal lifecycle | [useModalDialog](../frontend/src/useModalDialog.ts) | Evidence and promotion share native opening, Escape dismissal, keyboard isolation and connected-opener restoration. Promotion supplies board fallback and board-relative placement; Maia remains non-modal. |
| Native disclosure styling | [disclosure.css](../frontend/src/disclosure.css) | Apply disclosure to native details, retaining browser-owned toggling and markers. Shared summaries have 44px minimum targets; rich import history retains its content layout. The audio studio reuses these shared-safe rules for sources and playback history. |
| Board/sidebar layout | [ReviewWorkspace](../frontend/src/ReviewWorkspace.tsx), [review-presentation.css](../frontend/src/review-presentation.css) | Shared board sizing and slots for status, evaluation, controls and sidebar; mobile coach placement. |
| Board turn indicator | [TurnIndicator](../frontend/src/TurnIndicator.tsx) | Decorative color dot with caller-supplied status text. Due, lessons and puzzles retain their distinct status and visibility rules. |
| Coach bubble, portrait and action geometry | [ReviewCoach](../frontend/src/ReviewCoach.tsx), [coach-presentation.css](../frontend/src/coach-presentation.css) | Shared title, badge, evaluation, explanation, detail, insight, caption and actions. One shared height (136px desktop, 156px narrow) holds the title, about three lines of explanation and the footer; longer lines, including a joined spoken line, scroll inside the message, which never shrinks below two lines. The footer sits outside the scrolling message: an optional `detail` line (game review's moves line) and the Maia insight share one row when they fit and wrap otherwise, so neither is clipped, ellipsized or scrolled away. `compactLabel` fits the title row to its text for modes with no evaluation or voice control (lessons). Preserve stable portrait identity and message-scroll reset behavior. Optional speech playback goes to the shared avatar; a custom character owns its own handle. |
| Registered coach artwork/performance | [CoachAvatar / CoachCharacter](../frontend/src/coach/CoachAvatar.tsx), [registry](../frontend/src/coach/registry.ts) | App-selected avatar versus explicit preview character. Use registry metadata; do not maintain another cast list. Speech-capable rigs reuse `useSpeechPerformance` and the audio engine's live clock; optional `SpeechMouthTrack` uses shared semantic shapes, not tool-specific IDs or per-page talking timers. `HumanFeatures` has an optional mouth slot with its exact authored fallback. The studio's two-portrait comparison composes this same character instead of duplicating a review bubble. |
| Speech mouth layers | [SpeechMouthLayer / OrganicSpeechMouth](../frontend/src/coach/SpeechMouthLayer.tsx), [speech-mouth.css](../frontend/src/coach/speech-mouth.css) | The layer preserves exact authored mouth artwork when silent or Still and cross-fades between the two mouths when a line starts or ends; a developer's explicit held-shape preview is static inspection. Organic mouths share geometry driven by the existing speech controls, including distinct round/puckered shapes, aspect compensation and a common moving interior clip. Species own placement, palette, mood (or an explicit upper-lip curve for a mouth drawn along a seam, as Fergus's is) and optional teeth/fangs/tongue/interior; mechanical mouths can reuse only the layer. Do not add per-artwork clocks or cue timing. Walter retains his existing dedicated rig. |
| Authored SVG rig layers | [ArtworkRig](../frontend/src/coach/ArtworkRig.tsx) | Decorative SVG frame and identical study body/head layers. Keep species art, CSS, poses, viewBoxes and accent placement with their family. Classic's distinct rig remains separate. |
| Rendered coaching text | [DialogueText](../frontend/src/dialogue/DialogueText.tsx) | Supported utterance text and intent/variant metadata. Production defaults to a polite paragraph; lab previews explicitly use announce=false and optionally as=dd for definition lists. |
| Coach's spoken line as bubble text | [useSpokenText / useSelectedCoachSpokenText](../frontend/src/audio/speech/spokenText.ts) | The coach's recorded line for a selected meaning, else its script line; null while loading or unknown, so callers keep their written text. Callers keep selecting the meaning (gameSelection/practiceSelection) and replace only a 1:1 coach sentence; DialogueText's optional `recordingId` marks the replacement as `data-spoken`. Scripts load lazily per coach. |
| Game review moves line | [CoachMovesLine](../frontend/src/gameReview/CoachMovesLine.tsx) | Opening name, `<Side>’s strongest reply: <SAN>` (the engine reply, never the move played) and a claim-proven qualifier, read from report/position facts only (never prose). Rendered in ReviewCoach's `detail` slot only while the bubble shows a spoken line; it wraps rather than truncating and is not a separate live region. Game-review specific; other modes keep their own concrete text. |
| Move-quality symbol and labelled badge | [MoveSymbol](../frontend/src/MoveSymbol.tsx), [MoveBadge](../frontend/src/MoveBadge.tsx) | One icon/label rendering path. Objective move quality and practice attempt outcomes remain different concepts. |
| White-perspective position score | [EvaluationScore](../frontend/src/EvaluationScore.tsx), [evaluation helpers](../frontend/src/evaluation.ts) | Signed pawn/mate formatting, winning-side styling and accessible perspective. Never pass side-to-move candidate scores without conversion. |
| Accuracy display | [AccuracyReadout / PlayerRow](../frontend/src/gameReview/Players.tsx) | Player, summary and passive history presentations share unavailable/completion wording and one-decimal formatting. History keeps its row-level accessible description. |
| Library insights | [GameInsights](../frontend/src/GameInsights.tsx), [game-insights.css](../frontend/src/game-insights.css) | Insights → Overview only. Composes ChoiceGroup filters, StatList, LoadState, EmptyState, Link and the shared outcome colours; its bar, split and heatmap marks are local because no other screen charts aggregates. Promote them before a second consumer copies them. |
| Saved game list | [GameHistory](../frontend/src/GameHistory.tsx), [game-history.css](../frontend/src/game-history.css) | Shared dates, player rows, outcomes, passive accuracy and review links. Games uses the default comparison table, adapting to its container width. Home uses explicit compact presentation: full-width player/score rows and a wrapping result/time/date/accuracy/review footer, without column headings or striping. Move count remains in the accessible description and the full library. All variant styles live with GameHistory; callers own fetch limits, enclosing panels and pagination. |
| Practice move status | [MoveStatus](../frontend/src/MoveStatus.tsx), [move-status.css](../frontend/src/move-status.css) | Stable atomic live region, 350ms delayed checking and retry presentation. Optional rich content retains lesson paragraphs; do not pass general playback/navigation busy state as move grading. |
| Saved recall receipt | [RecallReceipt](../frontend/src/srsReview/RecallReceipt.tsx) | Relative next-due text with exact date/time tooltip. Callers supply scheduling explanations and whether a due time applies; cold positions render no receipt. |
| Motion preference field | [MotionSelect](../frontend/src/MotionSelect.tsx), [motion-select.css](../frontend/src/motion-select.css) | Device default / Animated / Still choices in Settings and Studio. Inline or stacked layout; callback and persistence stay caller-owned. Shared-safe styles; Settings status/layout remains in application-only motion.css. |
| Account preference lifecycle | [useSavedPreferences](../frontend/src/useSavedPreferences.ts), [CoachProvider](../frontend/src/coach/CoachProvider.tsx), [MotionProvider](../frontend/src/MotionProvider.tsx) | Existing shared load/save/retry and stale-response handling. Reuse the contexts; presentation extraction does not need new storage. |
| Audio preferences and playback | [AudioProvider / useAudioScope](../frontend/src/audio/AudioProvider.tsx), [AudioSettings](../frontend/src/audio/AudioSettings.tsx), [AudioMuteButton](../frontend/src/audio/AudioMuteButton.tsx) | Reuses account preference persistence. Quick device mute is the last control inside each board-controls group (beside Flip in game review), so it shares that group's sizing, spacing and shrink rules; the workspace renders it alone only when a page has no board controls. Session/playback handlers send explicit semantic events through scoped controls. Do not add Audio instances, FEN-driven sound effects, coach-expression audio or separate page sound schedulers. See [Audio](AUDIO.md). |
| Development studio playback | [useStudioPlayer](../frontend/src/audio/studio/useStudioPlayer.ts), [StudioTransport](../frontend/src/audio/studio/StudioTransport.tsx) | Shared player and transport for the audio studio's Walter wording review and recorded coach comparison; development-only, never imported by the application. The cast audition and casting-choice components were removed on 2026-10-03 once casting finished. |
| Recorded coach voice | [useCoachSpeech](../frontend/src/audio/speech/useCoachSpeech.tsx), [CoachSpeechButton](../frontend/src/audio/speech/CoachSpeechButton.tsx) | Supply supported recording IDs and fresh action identity. ReviewCoach owns the shared voice control beside its evaluation; explicit secondary explanations reuse CoachSpeechButton. Keep cold prompts manual, lessons silent and replay cancellation scoped. Mouth animation observes the existing speech clock, never a separate page timer. |
| Preference save feedback | [PreferenceStatus](../frontend/src/PreferenceStatus.tsx) | Shared saving/error/loading/saved/idle precedence, retry action and reserved line. Heading or field placement; persistence and saved flags stay with the caller. |
| Pending/unavailable content | [LoadingState / UnavailableState](../frontend/src/LoadState.tsx) | Compact/panel states with message-only announcements and separate caller-supplied headings/actions. Requests, recovery commands and link destinations remain with each screen. |
| Empty content | [EmptyState](../frontend/src/EmptyState.tsx) | Lessons/Puzzles presentation for full sections, with compact activity/search variants. Callers supply titles, descriptions, icons and recovery actions. |
| Notices | [Notice](../frontend/src/Notice.tsx), [notice.css](../frontend/src/notice.css) | Explicit alert/status/passive policy, tone, panel/inline presentation and separate actions. Historical import errors remain passive; persistent live regions can stay mounted empty without blank spacing. Shared-safe presentation also serves studio availability and playback feedback without importing application layout. [WelcomeBack](../frontend/src/WelcomeBack.tsx) and the Settings analysis-queue line use it too; the welcome-back import link sits in the body so narrow screens keep the text full width. |
| Provider connection UI | [GameSync](../frontend/src/GameSync.tsx) | Compact Games action and expanded Settings cards use the same provider discovery/sync state. |
| Provider username | [ProviderUsernameField](../frontend/src/ProviderUsernameField.tsx) | Shared native rules, unique labels/help IDs and 50-character limit. Optional connection/onboarding versus required import and busy/draft state remain caller-owned. |
| Provider history import | [ProviderImportForm](../frontend/src/ProviderImport.tsx), [ImportSettings](../frontend/src/Import.tsx) | One data-driven form for all registered providers. ImportSettings owns the shared title/Close row and cancellable exit for provider and PGN forms. Both use imports.css for aligned fields, an action footer and matching 450ms layout expansion/collapse governed by the existing interface-motion preference. A persistent grid shell animates the occupied height; do not reserve full height before fading the form. Still closes immediately; closing forms are retained and inert until the transition ends, and reopening reverses the transition without losing drafts. Do not add separate provider forms or nested panel/toolbar shells. |
| Import option and submit action | [ImportControls](../frontend/src/ImportControls.tsx) | Shared optional training-analysis checkbox and submit label/icon/busy presentation. PGN matching, provider filters and request payloads remain caller-owned. |
| Active/completed import jobs | [ImportJob](../frontend/src/ProviderImport.tsx) | Shared job contents with active and compact history presentations. |
| Source attribution | [SourceLine](../frontend/src/SourceLine.tsx), [LessonAttribution](../frontend/src/study/LessonAttribution.tsx) | Shared text, optional license/revision and valid absolute HTTP(S) source/license links. Optional licenseUrl links the existing license label separately from View source. LessonAttribution resolves Repository license at render time without changing saved course fingerprints. Lesson sources remain multiple records; puzzle provenance remains completion-only. The audio studio uses SourceLine for recording credits; source-line.css is shared-safe. |
| Local review tabs | [ReviewMoves](../frontend/src/gameReview/ReviewMoves.tsx) | The existing implementation has linked tab/panel IDs, roving focus and arrow/Home/End behavior. It is not yet an exported generic tabs component. |
| Native controls and visual utilities | [foundation.css](../frontend/src/foundation.css), [base.css](../frontend/src/base.css) | Specialized native controls, typography, panels and action rows retain CSS foundations. Use the named components above for ordinary actions, notices, pagination and empty states; native dialogs share useModalDialog. |

Quick mute belongs to each page's board-controls group rather than trailing it,
so it never wraps onto its own row or keeps a different size from its neighbours.
The cold SRS toolbar contains only that mute control; it is not an empty row to hide.

## Audit baseline and coverage

Source audit on **September 29, 2026**, against **4635738**. All **99 TSX files**
under the production and development source entrypoints were inventoried and
reviewed by scope, with adjacent styles and relevant consumers:

- 29 top-level application/dialogue files: shell, account/onboarding, settings,
  imports, motion, game history, weaknesses, board/review/evaluation and primitives.
- 11 `gameReview/` and `srsReview/` presentation files.
- 8 `study/` files: StudyScreen, LessonLibrary, LessonPlayer, LessonAttribution,
  PuzzlePlayer, OpeningCatalogue, OpeningStudies and OpeningLinePreview.
- 47 `coach/` files: preferences/providers, avatar, studio controls and every
  artwork family/supporting JSX component.
- 4 development entrypoint/lab files in `coach-studio/` and `intelligence-lab/`.

This is a static reuse/consistency audit, grounded in code and the owner's two
selector screenshots. It is not a new whole-site browser validation or a review
of engine/backend correctness. Findings below distinguish actual divergent
implementations from smaller opportunities that already share styling. No UI
migration is approved or completed merely because it appears here.

## Owner decision record

Recorded September 29, 2026 from the owner's completed 30-item comparison and
subsequent conversation. This is the authoritative decision record; the later
clarifications below supersede the original browser answers. It is committed
repository documentation and does not depend on browser storage.

**Implementation is authorized.** Each completed choice receives its own verified
commit so it can be reviewed or reverted independently. All 26 approved choices
are complete; UI-18 and UI-30 remain unchanged, and UI-26 and UI-29 remain deferred.
The implementation notes below record each choice's checks and commit subject.

The main application always takes precedence over development tools when
choosing a shared implementation. Promotion centralizes equivalent UI; it does
not erase differences in navigation semantics, domain behavior or accessibility.

| ID | Decision | Status | Commit(s) | Required interpretation |
| --- | --- | --- | --- | --- |
| UI-01 | Promote the Settings section-navigation tray (A). | Complete | `3a823f3` | `SectionNavigation` serves Settings and Openings; URL history and account/course filtering are preserved. |
| UI-02 | Promote the application's PGN rectangular choice buttons (A). | Complete | `c9e010b` | `ChoiceGroup` serves PGN source and Studio filters, preserving pressed-button semantics and caller-owned clearing/filtering. |
| UI-03 | One shared button family with ordinary, compact and icon-only sizes, plus primary, secondary and purple return styles. | Complete | `7fc1487` | Button, IconButton and ActionLink serve ordinary application actions and actual-size Studio coach actions. Purple appearance is consolidated separately in UI-04. Specialized choices/notation/playback remain distinct. |
| UI-04 | Promote Game Review's purple return action (A). | Complete | `4b326fb` | ReturnButton shares the purple style and icon while each mode retains its label, handler, disabled/focus behavior and branch state. |
| UI-05 | Promote lesson/opening playback geometry (C/D). | Complete | `06f2fba`, `27fc53d` | Four playback surfaces share controls and fixed counter geometry; game variation/ply-zero behavior, separate flip, responsive toolbar and lesson pending-focus rules remain intact. |
| UI-06 | Promote catalogue pagination labels and layout (B). | Complete | `194c306` | Shared Pagination uses real destination links; 30-game/50-line ranges, filters, history and empty-page recovery remain caller-owned. |
| UI-07 | Share continuation-move markup. | Complete | `ab5ab23` | Puzzles and opening previews share ContinuationMoves with caller-owned numbering, selection and disabled state. Full-game scored notation stays specialized. |
| UI-08 | Share move-feedback announcement rules while retaining rich lesson layout. | Complete | `3e6a59e` | Due, puzzles and lessons use MoveStatus. Puzzles share delayed checking; lesson paragraphs remain rich and navigation never replaces them with Checking. |
| UI-09 | Promote relative next-due time with an exact-time tooltip (A). | Complete | `99779e7` | RecallReceipt serves game and opening recalls while their existing domain rules choose saved/relearning/retired/unscheduled copy. |
| UI-10 | Share preference-status rendering with heading and field placements. | Complete | `941556b` | Coach selection and both motion fields use PreferenceStatus; providers, saved flags, retry labels and device fallback remain unchanged. |
| UI-11 | Share compact/panel loading and unavailable states. | Complete | `a6b1381` | Seven audited consumers share LoadingState/UnavailableState without moving request or recovery logic; pending-to-error transitions preserve navigation focus. |
| UI-12 | Share notice tone/actions with explicit alert, status and passive modes. | Complete | `a4df5d8` | Shared Notice preserves current alerts, passive history and mounted Settings result announcements. Move feedback and preference lifecycle remain distinct. |
| UI-13 | Promote Lessons/Puzzles empty-state styling (C/D) for full sections. | Complete | `65522cc` | EmptyState serves seven application consumers; activity/search remain compact and recovery destinations are preserved. |
| UI-14 | Share provider username field rules. | Complete | `e935bae` | ProviderUsernameField serves Settings connection, one-time import and onboarding; native validation and description association are centralized. |
| UI-15 | Share the existing PGN/provider analysis option and import action (A/B). | Complete | `25356e3` | ImportSubmitButton serves both forms; onboarding says Import games and each form retains its request fields and busy copy. The analysis option was removed when every game became analyzed automatically. |
| UI-16 | Adopt the evidence dialog's modal keyboard/focus behavior for promotion. | Complete | `1e8edef` | Promotion uses the shared native modal lifecycle, preserving legal choices, drag timing and board-relative placement; page shortcuts yield while a modal is open. |
| UI-17 | Promote plain native-summary styling (A). | Complete | `a37fb87` | Shared native-summary rules serve connection/import/review/weakness/variation disclosures, preserving 44px targets, rich history contents and cold-practice restrictions. |
| UI-18 | Keep section headings and the distinct action-row layouts separate. | Keep existing | — | Do not extract a universal component for these different roles. |
| UI-19 | Promote the existing resume-row style and share its markup (A/B/C). | Complete | `d95d27e` | ResumeLink owns identical lesson, puzzle and course-line rows; native Link behavior and caller destinations/content are preserved. |
| UI-20 | Share the existing puzzle/opening statistics markup in a small StatList. | Complete | `6e8a380` | Both statistics panels share StatList with their original labels, values, visibility and appearance. |
| UI-21 | Share only the turn indicator used by the board-status compositions. | Complete | `f9c8725` | Due, lessons and puzzles share the dot; surrounding status and cold-practice visibility stay caller-owned. Opening preview has no existing dot and remains unchanged. |
| UI-22 | Extend the application's AccuracyReadout with a history presentation. | Complete | `fc5b2e3` | History shares formatting and completion descriptions; its numeric spans remain passive and queued reviews retain their action state. |
| UI-23 | Share source/link formatting. | Complete | `c18a977` | SourceLine serves lessons, puzzle completion and opening previews, preserving optional license/revision and multiple records while validating external protocols. |
| UI-24 | Promote the application's existing MotionSelect into Studio (A). | Complete | `2c7b8d2` | Studio uses `MotionSelect` with shared-safe control styles and still clears its simulated reduced-motion setting on selection. |
| UI-25 | Use the application's real EvaluationScore in Studio (B). | Complete | `f1914a1` | Board-size Studio previews use `EvaluationScore` with typed illustrative scores, correct White perspective, side styling and accessible text. |
| UI-26 | Defer coach-card/selector extraction. | Deferred | — | Keep current Settings and Studio workflows, shared registry/artwork, and the Settings six-column grid. |
| UI-27 | Share identical artwork/rig wrappers. | Complete | `bcc2d0a` | `ArtworkSvg`, `BodyRig` and `HeadRig` serve production family artwork; art, geometry, eyes, animation and species-specific layers remain unchanged. |
| UI-28 | Share application dialogue text/metadata with explicit non-live lab rendering. | Complete | `11b7c93` | Lab and comparison cards use `DialogueText` with announce=false; definition-list samples retain dd and production retains its polite default. |
| UI-29 | Defer development-tool checkbox-row extraction. | Deferred | — | Leave current tool implementations in place for this pass. |
| UI-30 | Leave the existing eye implementations alone. | Keep existing | — | Owner's later "just leave it" supersedes the initial mechanics-only extraction choice. No eye refactor in this pass. |

The temporary gallery presented 127 source-based examples against snapshot
**18be413** and was committed in **51da684**. It was removed at the owner's
request after capturing these decisions. Historical examples remain recoverable
from Git; no live decision-gathering tool is needed.

### Implementation and verification

- **UI-01 — shared section navigation:** promoted the Settings tray, removed both
  page-specific navigation styles, and scoped main-header `nav` rules to the
  header. Production build (API, TypeScript, style boundaries and Vite) passed.
  `ui-standardization`, `settings` and `opening-library` browser suites passed
  **30 desktop/mobile tests**, including 320px targets/overflow, URL history,
  account filtering and hiding navigation inside courses. Inspected the rendered
  Openings tray in the application. Commit subject: `UI-01: Share Settings and
  Openings section navigation`.
- **UI-03 — shared action family:** migrated application form, account, import,
  settings, review, evidence and study actions, removing competing size rules.
  Destination actions use links; submit buttons are explicit; focus/ref and
  pending-command semantics remain intact. Independent review caught the Studio
  board-size preview still using the old generic button; it now uses the same
  compact action. Production build passed. Initial affected application run:
  **99 passed, 3 intentional viewport skips, 2 failures** in a new test that omitted
  a required import username. Corrected action-contract rerun: **7 passed, 1
  intentional mobile modifier-click skip**. Account suite: **8 passed** after
  correcting the local harness to use its existing second-device port. Studio
  action preview: **2 passed**. Existing Settings, provider, review, variation,
  training and lesson behavior passed; inspected phone Settings rendering.
  Commit subject: `UI-03: Standardize application buttons and action links`.
- **UI-02 — shared local choices:** promoted PGN source styling into `ChoiceGroup`
  and removed Studio's separate pill treatment. Production build passed, including
  both standalone CSS guards. Focused PGN and Studio filter checks passed **4
  desktop/mobile tests**, then passed again after correcting local fixture-server
  teardown permissions. Cover inactive-input clearing, request payloads, all
  expression groups, independent inspected expression, pressed state, 320px
  wrapping and tap targets. Commit subject: `UI-02: Share PGN and Studio choice
  controls`.
- **UI-24 — shared motion selector:** Studio now uses the application control,
  including its values, native label association and 44px minimum target. Added
  a stacked layout for toolbars while preserving Settings' inline layout. CI now
  recognizes the control as shared. Production build passed; **6 application
  motion tests**, **2 Studio device/simulation tests**, **207 CI-planner tests**
  and focused Ruff checks passed. Commit subject: `UI-24: Reuse application motion
  selector in Studio`.
- **UI-25 — shared evaluation display:** removed the Studio's manually formatted
  score span. Illustrative centipawn/mate values now use the same typed score and
  renderer as the application; missing values remain honestly unavailable.
  Corrected CI's former application-only classification. Production build passed;
  **2 desktop/mobile preview tests** verify positive/negative, mate for either
  side, equal and unknown scores in both panel sizes. The initial mobile assertion
  incorrectly expected an accessible name on the intentionally hidden roomy
  preview; assertions now check names on visible previews and metadata on both.
  **209 CI-planner tests** and focused Ruff checks passed. Commit subject:
  `UI-25: Use real evaluation scores in coach previews`.
- **UI-27 — shared artwork layers:** extracted only identical decorative SVG,
  body and head nesting across 14 artwork files. An expanded-source AST comparison
  confirmed unchanged authored nodes, attributes, expressions and hierarchy.
  Production build and **16 desktop/mobile rig and coach-study tests** passed,
  covering every registered coach/expression's channels, framing, transform
  origins, species layers, existing animation and reduced motion. No eye, artwork,
  gesture or cadence changes. Commit subject: `UI-27: Share identical coach SVG
  rig layers`.
- **UI-28 — shared dialogue rendering:** lab inspection and comparison samples
  now reuse supported text and trace metadata without creating live announcements
  for every coach. The component's production default is unchanged. Production
  build/types passed. **10 desktop/mobile laboratory/corpus tests passed**,
  including actual React rendering of both live paragraphs and passive definition
  entries. Replaced an incompatible test-runner JSX/SSR test with real browser
  rendering; no production workaround was required. Commit subject: `UI-28: Share
  dialogue rendering with passive developer previews`.

- **UI-22 — history accuracy:** history now uses the same accuracy readout as
  player rows and move quality, including one-decimal values and unavailable
  descriptions. Queued/stale results retain their review action; library polling
  does not announce every numeric value. Validation: production build (including
  type/API/style checks) and game-history/game-review-presentation browser tests:
  **8 passed** across desktop/mobile. Commit subject: `UI-22: Share accuracy
  readouts across history and review`.

- **UI-04 — return actions:** game variations and both lesson return paths use
  ReturnButton. Removed duplicate colors/icons/hover rules; long labels fit narrow
  phones. Production build passed; variation-navigation and study-lessons:
  **20 passed** across desktop/mobile, including 320px fit, canonical appearance,
  branch restoration, ply-zero exit and lesson focus/context preservation. Commit
  subject: `UI-04: Share prominent return actions across review and lessons`.

- **UI-06 — pagination:** promoted the catalogue layout/labels for both libraries,
  replaced navigation commands with links and removed duplicate CSS. Production
  build passed. Pagination/navigation coverage: **13 passed, 1 intentional mobile
  modifier-click skip**, covering ranges, boundaries, search filters, empty pages,
  keyboard activation and browser scroll/history restoration. Commit subject:
  `UI-06: Share linked pagination across game and opening libraries`.

- **UI-14 — provider usernames:** shared the field without moving draft, hydration,
  submission or persistence logic. Escaped the literal hyphen for native pattern
  validation. Production build and independent source review passed; focused
  browser tests: **4 passed**, covering optional/required names, valid/invalid
  characters, length, accessible descriptions, unique IDs and onboarding save
  locks. Commit subject: `UI-14: Share provider username fields`.

- **UI-10 — preference feedback:** centralized presentation and reserved geometry
  without changing requests or account state. Production build passed; gated
  load/save/error/retry coverage: **4 passed** across desktop/mobile, including
  all three fields, fallback copy, reload and independent saved flags. Commit
  subject: `UI-10: Share preference loading and save feedback`.

- **UI-08 — move feedback:** moved status-owned styles with MoveStatus and shared
  its announcement contract across practice players. Production build passed;
  focused browser coverage: **6 passed**, checking repeated slow/fast puzzle
  requests, timer cancellation, rich lesson results and stable full-game
  commentary during pending navigation. Commit subject: `UI-08: Share practice
  feedback announcements without lesson flicker`.

- **UI-09 — scheduling receipts:** both recall players share relative due text and
  an exact-time tooltip. Domain messages, retirement and unscheduled precedence
  remain caller-owned. Production build passed; receipt coverage: **8 passed**,
  including minute/hour/day boundaries, no cold disclosure, both players'
  relearning/retired states and previously recorded opening recalls. Commit
  subject: `UI-09: Share relative due receipts across recall modes`.

- **UI-16 — promotion modal:** shared EvidenceDialog's native lifecycle through
  useModalDialog and retained promotion's board-relative responsive placement.
  Focus returns to the opener or board; native Tab/Escape work without triggering
  game shortcuts. Production build passed. Focused component browser coverage:
  **18 passed, 4 intentional mobile skips** for mouse-only drag cases. Actual
  Due and puzzle promotion checks also passed on desktop/mobile. Reviewed modal
  screenshots at both sizes. Commit subject: `UI-16: Share native modal focus
  behavior with board promotion`.

- **UI-05 — playback controls:** Game Review, SRS explanations, lesson full games
  and opening previews use MovePlaybackControls. Removed duplicate geometry;
  preserved caption text and every caller's commands. Production build passed;
  playback/variation tests: **8 passed**, connected lessons: **14 passed**, and
  training: **39 passed, 1 intentional viewport skip**. Checks include 320px fit,
  9→10 counter stability, ply-zero exit, original-game restoration and explanation
  navigation. Commit subject: `UI-05: Share move playback controls across players`.
  Integration follow-up: the shared empty-toolbar reservation now matches the
  ordinary 42px control, fixing a six-pixel Game/SRS board-size difference.
  Review presentation checks passed (**5 passed, 1 intentional mobile skip**),
  including exact board and coach geometry equality. Follow-up commit subject:
  `UI-05: Keep review board sizes aligned with shared playback controls`.

- **UI-19 — resume rows:** shared the existing row and component-owned styles
  across saved puzzles, lessons and course lines. Production build passed;
  focused real-fixture navigation tests: **2 passed**, including keyboard/Back,
  desktop modifier clicks, unchanged saved sessions and revision-specific course
  links. Corrected a new test that omitted the course prefix from the actual
  preview heading. Commit subject: `UI-19: Share saved-study resume links`.

- **UI-15 — import controls:** shared checkbox/action presentation while retaining
  PGN multipart and provider-filter request contracts. Production build passed;
  gated import tests: **4 passed**, including pending-state actions, independently
  edited drafts and captured request values. New test locators were corrected to
  use native textbox/combobox accessible names after filling. Commit subject:
  `UI-15: Share import analysis and submit controls`.

- **UI-20 — statistics:** centralized definition-list markup and its existing
  styles without changing metrics or visibility. Production build passed;
  focused desktop/mobile tests: **2 passed**, checking labels, zero values,
  shared geometry and no phone overflow. Commit subject: `UI-20: Share study
  statistics markup and styles`.

- **UI-11 — loading and recovery:** shared compact/panel messages and action
  layout across review, evidence, lessons, puzzles and opening previews. Removed
  the unused loading class. Production build passed; API-gated browser tests:
  **20 passed** across desktop/320px mobile. Checks preserve retries, links,
  keyboard focus and cold-practice silence while loading. Commit subject:
  `UI-11: Share loading and unavailable content states`.

- **UI-23 — source attribution:** shared source lines and safe external-link
  formatting without changing provenance or exposing puzzle sources before
  completion. Production build passed; browser coverage: **6 passed**, including
  multiple/empty citations, unsafe and malformed URLs, puzzle reveal gating,
  catalogue CC0 revisions and authored-course identity. Commit subject:
  `UI-23: Share source attribution across study players`.

- **UI-21 — turn indicator:** extracted the existing decorative dot and its styles
  from Due, lessons and puzzles without changing their status text. Production
  build passed; all **14 connected lesson checks** and both desktop/mobile SRS
  motion/cold-answer checks passed. The separate board-sizing regression found
  during integration is tracked under UI-05. Commit subject:
  `UI-21: Share the board turn indicator without changing status content`.

- **UI-13 — empty content:** promoted lesson/puzzle presentation to shared
  section and compact variants. Production build passed; **4 desktop/mobile
  checks passed** for consistent geometry, recovery links and compact embedded
  activity/search states. Nonempty content and copy remain unchanged. Commit
  subject: `UI-13: Share section and compact empty states`.

- **UI-17 — native disclosures:** centralized summary appearance, native markers,
  open spacing and phone targets. Rich import-history rows retain their content
  layout. Integration review also caught and migrated the Game Review variation
  summary. Production build and **6 desktop/mobile disclosure checks passed**,
  including keyboard/touch activation, rerender persistence and cold-answer
  restrictions. Commit subject: `UI-17: Standardize native disclosure summaries`.

- **UI-12 — notices:** centralized tones/actions with required announcement
  policy. Historical job errors stay passive; Settings' live status region
  remains mounted between results. Production build and **12 desktop/mobile
  checks passed**, including account/import/sync failures, dismissal, unchanged
  announcement nodes and passive historical errors. Commit subject:
  `UI-12: Share notices with explicit announcement behavior`.

- **UI-07 — continuation selection:** shared Start/SAN markup with explicit
  numbering and selection. Production build passed; **18 checks passed** across
  three desktop/mobile repetitions, covering cold gating, disabled playback,
  numbered openings and repeated SAN positions. Fixed new tests to wait for
  observable board commits with the virtual animation clock and to create
  independent sessions on repetition. Commit subject:
  `UI-07: Share selectable continuation controls`.

## Audit findings and implementation boundaries

The source evidence below explains the decisions. Proposed component names are
design directions, not existing modules. The owner decision record above governs
scope and takes precedence over optional extraction suggestions in this audit.

### Visible and behavioral mismatches

| ID | Same job, separate implementations | Observed mismatch | Proposed standard / preserved boundary |
| --- | --- | --- | --- |
| UI-01 | [Settings section links](../frontend/src/Settings.tsx) and [Opening section links](../frontend/src/study/StudyScreen.tsx) | Both use `Link` and `aria-current="page"`. Settings has a framed tray, 44px items and orange underline; Openings has a bottom rule, different padding and grey active/hover styling. Separate `settings-navigation` / `opening-sections` rules. Global `nav` styles in `base.css` also leak shell layout into subnavigation. | One `SectionNavigation` for these URL-backed sections. Same size, spacing and selected appearance on both pages. Scope main-header navigation CSS. Keep account filtering, course nesting, URLs and history unchanged. |
| UI-02 | [PGN source buttons](../frontend/src/Import.tsx) and [studio expression filters](../frontend/src/coach/studio/ExpressionCollection.tsx) | Independently implement a labelled group of mutually exclusive pressed choices, selected colors and wrapping. Similar appearance to navigation, but these change local state. | Small single-choice group for applicable local choices, sharing selector visual tokens. Do not turn it into URL navigation or blindly assign tab roles. Changing PGN source still clears the inactive input. |
| UI-03 | Buttons, button-styled links and icon controls across [foundation.css](../frontend/src/foundation.css), [base.css](../frontend/src/base.css), [review CSS](../frontend/src/game-review.css), [Study CSS](../frontend/src/study/study.css) | Baseline CSS is shared; React markup and per-page sizes are not. Base buttons/links are 42px, mobile workspace buttons alone become 44px, with a special link patch for GameSync. Icon sizes, hit areas and disabled states are separately applied. Weakness Practice navigates via a button while equivalent study destinations are links. | Small Button/ActionLink/IconButton family with common size/variant tokens and explicit accessible labels. Preserve anchors for destinations and buttons for commands; no blanket anchor-to-button conversion. Remove compensating page overrides as consumers migrate. |
| UI-04 | [Game return action](../frontend/src/gameReview/PositionCoach.tsx) and [lesson return actions](../frontend/src/study/LessonPlayer.tsx) | `game-return` and `lesson-return` duplicate the prominent purple escape action but differ in purple, border, weight, icon and hover styling. | One return-action variant using UI-03. Keep context-specific labels and handlers; original-game, lesson and branch state still belongs to each mode. |
| UI-05 | [ReviewControls](../frontend/src/gameReview/ReviewControls.tsx), [ReviewExplanation](../frontend/src/ReviewExplanation.tsx), [LessonPlayer](../frontend/src/study/LessonPlayer.tsx), [OpeningLinePreview](../frontend/src/study/OpeningLinePreview.tsx) | Four previous/next/counter implementations, with different button dimensions, icon sizes and counter treatment. Lessons and opening preview even duplicate JSX while sharing the same CSS. | Controlled `MovePlaybackControls` with optional first/last/flip actions and surrounding slots. Preserve ply-zero behavior, variation exit, global keyboard shortcuts and the lesson's focus-preserving pending command behavior. It must not own session state or animation completion. |
| UI-06 | [Games pagination](../frontend/src/GameReview.tsx) and [catalogue pagination](../frontend/src/study/OpeningCatalogue.tsx) | Same previous/range/next interaction. Different labels/icons, 10px vs 8px gap, 20px vs 18px margin and mobile wrapping; both implement URL changes through buttons. | One Pagination layout and navigation contract. Keep 30-game versus 50-line paging, supplied counts and empty-page recovery; use actual destination links where no mutation is needed. |
| UI-07 | [Puzzle continuation](../frontend/src/study/PuzzlePlayer.tsx) and [opening continuation](../frontend/src/study/OpeningLinePreview.tsx) | Start + selectable SAN buttons independently rendered under the same `puzzle-move-list` CSS. Numbering and playback-disabled behavior vary. | Shared ContinuationMoves with explicit numbering/selection/disabled inputs. Full-game scored notation and branching remain specialized; they can share a move-button primitive later. |
| UI-08 | [MoveStatus](../frontend/src/MoveStatus.tsx) in Due versus [PuzzlePlayer](../frontend/src/study/PuzzlePlayer.tsx) and [LessonPlayer](../frontend/src/study/LessonPlayer.tsx) feedback | Due reserves a stable atomic live region and delays checking by 350ms. Puzzle uses immediate raw busy text; lesson uses another live wrapper and colored result paragraphs. | Extend the existing feedback/announcement presentation where suitable. Preserve rich lesson content, intentional playback copy and distinct practice outcomes; do not make every mode adopt SRS policy. |
| UI-09 | [Game recall receipt](../frontend/src/srsReview/ReviewPanel.tsx) and [opening recall receipt](../frontend/src/srsReview/OpeningRecallPanel.tsx) | Duplicate saved/relearning/retired/next-due rendering. Game recall uses relative time with an exact tooltip; openings use a full locale date/time. | Shared scheduling receipt and due-time display. Keep opening-specific retirement, previously recorded and unscheduled explanations supplied by their existing domain rules. |
| UI-10 | [Coach selection save state](../frontend/src/coach/CoachSettings.tsx) and both fields in [MotionSettings](../frontend/src/MotionSettings.tsx) | Three copies of Saving / Loading / Saved / error + retry rendering, local saved flags and status styles. | PreferenceStatus for presentation and reserved geometry. Reuse existing preference contexts/lifecycle; allow the device-setting fallback and field-specific retry labels. |
| UI-11 | [Review loading](../frontend/src/Review.tsx), [GameWorkspace](../frontend/src/gameReview/GameWorkspace.tsx), [EvidenceDialog](../frontend/src/EvidenceDialog.tsx), [LessonPlayer](../frontend/src/study/LessonPlayer.tsx), [PuzzlePlayer](../frontend/src/study/PuzzlePlayer.tsx), [LessonLibrary](../frontend/src/study/LessonLibrary.tsx), [OpeningLinePreview](../frontend/src/study/OpeningLinePreview.tsx) | Loading is variously a panel, paragraph or unannounced div. Lesson/puzzle unavailable shells are almost identical; other screens differ in retry/back arrangement. | LoadingState / UnavailableState with compact and panel presentation plus optional actions. Fetching, errors and retry policy remain in each screen. |
| UI-12 | Notices in [App](../frontend/src/App.tsx), [AccountGate](../frontend/src/AccountGate.tsx), [GameSync](../frontend/src/GameSync.tsx), [imports](../frontend/src/Import.tsx), [provider jobs](../frontend/src/ProviderImport.tsx) and [Study](../frontend/src/study/OpeningCatalogue.tsx) | Similar success/error content uses `.notice`, raw paragraphs, small spans and `.error-text`; alert/status roles and dismiss/retry arrangements differ. | Notice with explicit tone, announcement policy and actions. Historical job errors must remain passive rather than being re-announced as fresh alerts. Do not conflate this with move feedback or preference-save lifecycle. |
| UI-13 | Empty [Weaknesses](../frontend/src/Weaknesses.tsx), [Games](../frontend/src/GameReview.tsx), [Lessons](../frontend/src/study/LessonLibrary.tsx), [Puzzles](../frontend/src/study/StudyScreen.tsx) and [import activity](../frontend/src/Import.tsx) | Centered `.empty-state`, separate `.study-empty`, plain panels and horizontal icon rows; padding, title hierarchy and body width differ. | EmptyState with section and compact variants. Search-no-results remains compact; don't inflate an embedded empty activity row into a full-page illustration. |
| UI-14 | Provider username controls in [GameSync](../frontend/src/GameSync.tsx), [ProviderImportForm](../frontend/src/ProviderImport.tsx), [Onboarding](../frontend/src/Onboarding.tsx) | Same provider identity and character rules recreated with differing labels/help/disabled behavior. Generic form layouts also repeat spacing and help markup; only some fields explicitly connect descriptions. | ProviderUsernameField plus a small Field/FieldHelp convention. Keep optional connection/onboarding names versus required one-time import. Fieldwork account credentials have different rules and must stay separate. |
| UI-15 | PGN and provider forms in [Import](../frontend/src/Import.tsx) / [ProviderImport](../frontend/src/ProviderImport.tsx) | Exact same training-analysis checkbox and conditional submit wording/icon are duplicated. Onboarding still refers to “Fetch games” while the form now says “Import games.” | Shared ImportAnalysisOption/action presentation, with appropriate busy text. Keep request bodies, PGN matching and provider filters independent; align onboarding copy when migrating. |
| UI-16 | [Evidence dialog](../frontend/src/EvidenceDialog.tsx) and [Board promotion](../frontend/src/Board.tsx) | Evidence uses native modal opening/closing and restores focus. Promotion declares `aria-modal` on a positioned div without equivalent focus/Escape lifecycle. | Shared modal/focus contract with context-appropriate rendering and labels. Keep the evidence board read-only; verify promotion focus within interactive board consumers and modal focus separately. Maia's native light-dismiss popover is intentionally non-modal and should remain so. |
| UI-17 | Native disclosures in [GameSync](../frontend/src/GameSync.tsx), [ProviderImport](../frontend/src/ProviderImport.tsx), [Weaknesses](../frontend/src/Weaknesses.tsx), [ReviewDetails](../frontend/src/srsReview/ReviewDetails.tsx) | Base summaries share native behavior but target heights, chevrons/markers, open spacing and rich-history affordances vary. The import history toggle's CSS currently lives in `game-history.css`. | Standard summary tokens/ownership first; thin Disclosure variants only where repeated layout warrants it. Keep native details semantics and rich job summaries. Do not manufacture a custom accordion state machine. |

### Already partly shared; smaller reuse gaps

These are not all visible bugs. Some already share CSS and would benefit mainly
from one markup owner. Do not give them the same priority as the controls above.

| ID | Evidence / mismatch | Proposed scope |
| --- | --- | --- |
| UI-18 | [SettingsSection](../frontend/src/SettingsSection.tsx), [OpeningStudies heading/rows](../frontend/src/study/OpeningStudies.tsx), [PGN launcher](../frontend/src/Import.tsx), [Weaknesses rows](../frontend/src/Weaknesses.tsx) and [Training tools](../frontend/src/Settings.tsx) independently lay out title/body alongside actions and stack them on phones. | Owner chose to keep these distinct layouts. No shared SectionHeading/ActionRow extraction in this pass. |
| UI-19 | [StudyScreen](../frontend/src/study/StudyScreen.tsx) and [LessonLibrary](../frontend/src/study/LessonLibrary.tsx) repeat title/subtitle/arrow resume links using shared `.study-resume`. | ResumeLink for the identical row; catalogue links, chapter command rows and game history remain separate compositions. |
| UI-20 | [Puzzle stats](../frontend/src/study/StudyScreen.tsx) and [opening stats](../frontend/src/study/OpeningStudies.tsx) repeat `<dl>` metric items with shared `.study-stats`. | Owner selected a small shared StatList; keep the existing appearance supplied by shared CSS. |
| UI-21 | [Review](../frontend/src/Review.tsx), [LessonPlayer](../frontend/src/study/LessonPlayer.tsx), [PuzzlePlayer](../frontend/src/study/PuzzlePlayer.tsx), [OpeningLinePreview](../frontend/src/study/OpeningLinePreview.tsx) repeat `.review-position-status` and turn-dot markup. | Share only the turn indicator, as selected by the owner; retain each status composition. Never reveal hidden scores/source information in cold practice. |
| UI-22 | [GameHistory](../frontend/src/GameHistory.tsx) independently formats accuracy while [Players / AccuracyReadout](../frontend/src/gameReview/Players.tsx) is reused by review summary. History also independently renders names/ratings/colors. | Owner selected an AccuracyReadout history presentation. Retain its review action, compact two-player history grid and row-level accessible description; do not force it into a board player row or generic table. |
| UI-23 | [LessonAttribution](../frontend/src/study/LessonAttribution.tsx), [puzzle source footer](../frontend/src/study/PuzzlePlayer.tsx), [opening source footer](../frontend/src/study/OpeningLinePreview.tsx) repeat source text and external-link conventions. | Shared source-line/link formatting where applicable, with safe protocols and explicit optional license/revision. Distinct source records and provenance stay intact. |

### Development tools and artwork internals

These count toward the audit, but should not delay the visible application fixes.
Keep their standalone dependency boundaries intact.

| ID | Evidence / mismatch | Proposed scope |
| --- | --- | --- |
| UI-24 | [CoachStudio](../frontend/src/coach/studio/CoachStudio.tsx) repeats all three motion options instead of [MotionSelect](../frontend/src/MotionSelect.tsx). | Reuse the selector after separating its shared control styling from application-only layout. Preserve the studio callback that clears simulated reduced motion. |
| UI-25 | [BoardSizePreview](../frontend/src/coach/studio/PreviewPanels.tsx) hand-renders `.evaluation-score` from strings instead of [EvaluationScore](../frontend/src/EvaluationScore.tsx). | Use typed illustrative scores and the real component. Current preview omits winning-side styling and the accessible White-perspective description, so negative samples do not match production. |
| UI-26 | [CoachSettings](../frontend/src/coach/CoachSettings.tsx) and [studio CoachPicker](../frontend/src/coach/studio/CoachPicker.tsx) separately compose portrait + name choices. They already share registry/artwork. Cast dropdown options also repeat in [PerformanceCollections](../frontend/src/coach/studio/PerformanceCollections.tsx) and [IntelligenceLab](../frontend/intelligence-lab/IntelligenceLab.tsx). | Deferred by owner. Settings' persisted native radio gallery and studio's temporary preview buttons/counts remain separate; the lab retains its extra neutral-reference option and Settings its six-column grid. |
| UI-27 | [AnimalHead/AnimalFrame](../frontend/src/coach/cast/animals/AnimalParts.tsx) and [FantasyHead/FantasyShell](../frontend/src/coach/cast/fantasy/FantasyShell.tsx) duplicate head-layer nesting and SVG/body/pose scaffolding. Head layers also appear inline in human, dog and robot artwork. | A neutral rig wrapper could own the identical nesting, with explicit class/style slots. Keep species geometry, family CSS, expression tables and hands distinct. This is internal maintenance, not a mascot redesign. |
| UI-28 | [IntelligenceLab](../frontend/intelligence-lab/IntelligenceLab.tsx) and [CoachComparison](../frontend/intelligence-lab/CoachComparison.tsx) hand-render utterance text rather than using [DialogueText](../frontend/src/dialogue/DialogueText.tsx). | Owner selected shared application text/metadata rendering with an explicit non-live lab mode. Preserve production announcements, lab `<dd>` semantics and diagnostic layouts; avoid announcing every comparison card. |
| UI-29 | Checkbox rows in [CoachStudio](../frontend/src/coach/studio/CoachStudio.tsx), [IdlePlayback](../frontend/src/coach/studio/IdlePlayback.tsx), [PerformanceCollections](../frontend/src/coach/studio/PerformanceCollections.tsx), [CoachComparison](../frontend/intelligence-lab/CoachComparison.tsx) and [IntelligenceLab](../frontend/intelligence-lab/IntelligenceLab.tsx) use separate `.studio-reduced`, `.studio-toggle` and lab inline styling. | Deferred by owner. Keep current tool checkbox implementations for this pass. |
| UI-30 | [AnimalEyes](../frontend/src/coach/cast/animals/AnimalParts.tsx), [AnimalFace](../frontend/src/coach/studies/AnimalFace.tsx) and [FantasyFace](../frontend/src/coach/cast/fantasy/FantasyFace.tsx) repeat clipped gaze and open/closed eye mechanics around different art. | Owner chose to leave these implementations alone. No mechanics or artwork extraction in this pass. |

## Similar-looking components that should stay distinct

- **Route navigation / real tabs / choices:** Settings and Openings are URLs;
  Moves/Move quality is local tab content; PGN input selection is a form choice.
  Share a visual family, not one ambiguous interaction. The main site navigation
  also retains its top-level icon hierarchy and phone layout.
- **Whole players:** Game review, scheduled recall, lesson and puzzle sessions
  already compose Board, ReviewWorkspace and ReviewCoach. Their state, answer
  visibility, progress and grading are intentionally different.
- **Progress:** Background analysis pause/resume and numerical job completion are
  not the same as a lesson chapter, rehearsal or puzzle completion. ImportJob's
  active/compact presentations and ReviewProgress remain domain components.
- **Score perspectives:** Evidence candidate scores are side-to-move; the game
  score badge announces White's perspective. Board-bar one-decimal formatting
  versus fuller badges is an existing intentional density choice. Any common
  formatter must preserve perspective and precision explicitly.
- **Overlay purpose:** Maia insight is a native non-modal popover; promotion is a
  required move choice; evidence is a modal audit. Share appropriate close/focus
  primitives without making every overlay block the page.
- **Art direction:** Separate humans, pets, fantasy and science-fiction faces,
  hands and body geometry are intentional character work. Existing HumanFeatures,
  AnimalFace, AnimalEyes, FantasyFace, Arm and family hands already share mechanics
  where appropriate. Similar SVG shapes alone are not grounds to homogenize them.
- **Diagnostic dialogue:** The lab compares many utterances at once, whereas
  DialogueText announces the current in-game utterance. The lab uses its explicit
  non-live mode; do not announce every comparison card.
- **Native fields and disclosures:** Native select, radio, label, details and
  progress elements are already reusable browser behavior. Introduce components
  for actual common contracts, not to eliminate all native JSX.

## Maintenance and validation boundaries

The temporary comparison tool is retired. This document, linked from README and
AGENTS, is the durable inventory and decision record. Use the implemented owners
above when changing these interactions; the historical audit explains why they
were consolidated. Do not interpret a deferred row as authorization to implement
it later.

Application-only primitives and styles are explicitly classified in the CI
planner/style manifest. Shared Button, ChoiceGroup, MotionSelect, score, rig,
modal and dialogue code retain coverage for their development-tool consumers.
Unknown shared files still take the conservative path. Planner regression tests
check that application-only classifications cannot hide shared styles.

Whole-pass verification and any environment limitations are recorded in
[VERIFICATION.md](VERIFICATION.md). No schemas, chess authority, engine policy,
coach selection rules or animation timing were changed by this standardization.
