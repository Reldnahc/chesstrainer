# UI component reuse and standardization

This is the component lookup and reuse policy for Fieldwork frontend work. Read
it before adding or changing UI. It records what exists today separately from
proposed extractions, so an agent must not assume a proposed component is already
implemented. Keep this document current when a reusable component is added,
renamed, extended or retired.

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
8. **Respect entrypoint boundaries.** Application, coach studio and intelligence
   lab have separate CSS/dependency boundaries. Reusing a small control must not
   pull application shells into development tools. Use the existing
   [style manifest](../frontend/scripts/style-boundaries.json) and guard; do not
   weaken it or broaden CI solely to accommodate a misplaced import.
9. **Record justified differences.** If reuse is unsuitable, state the semantic
   reason and list the existing alternative here. Cosmetic preference alone is
   not a reason for two implementations of the same control.
10. **Verify every affected consumer.** Test the shared contract and representative
    desktop/mobile uses, including different busy/disabled states. Choose checks
    from [TESTING.md](TESTING.md) and the dependency boundaries; do not routinely
    run the full coach artwork matrix for application-only controls. Follow the
    owner's current verification instructions and record actual results.

## Existing reusable components

These are implemented now. CSS-only utilities are identified as such; they are
not React components.

| Job | Existing owner | Reuse contract |
| --- | --- | --- |
| Internal destination links | [Link](../frontend/src/Link.tsx), [navigation](../frontend/src/navigation.ts) | Normal anchors, modifier/new-tab clicks, history and scroll restoration. Do not implement another click-to-navigate wrapper. |
| Ordinary page heading | [PageTitle](../frontend/src/PageTitle.tsx) | Eyebrow, title and optional actions. Phones hide the eyebrow. Compact board-workspace headings remain a separate use case. |
| Settings section | [SettingsSection](../frontend/src/SettingsSection.tsx), [settings.css](../frontend/src/settings.css) | Labelled section, heading, optional description/actions and consistent spacing. Currently application/Settings-specific. |
| Board rendering and interaction | [Board](../frontend/src/Board.tsx), [board.css](../frontend/src/board.css) | Legal destination markers, tap/drag, promotion, highlights, piece motion and quality markers. Backend-supplied legality remains authoritative. |
| Board/sidebar layout | [ReviewWorkspace](../frontend/src/ReviewWorkspace.tsx), [review-presentation.css](../frontend/src/review-presentation.css) | Shared board sizing and slots for status, evaluation, controls and sidebar; mobile coach placement. |
| Coach bubble, portrait and action geometry | [ReviewCoach](../frontend/src/ReviewCoach.tsx), [coach-presentation.css](../frontend/src/coach-presentation.css) | Shared title, badge, evaluation, explanation, insight, caption and actions. Preserve stable portrait identity and message-scroll reset behavior. |
| Registered coach artwork/performance | [CoachAvatar / CoachCharacter](../frontend/src/coach/CoachAvatar.tsx), [registry](../frontend/src/coach/registry.ts) | App-selected avatar versus explicit preview character. Use registry metadata; do not maintain another cast list. |
| Rendered coaching text | [DialogueText](../frontend/src/dialogue/DialogueText.tsx) | Supported utterance text and intent/variant metadata. Its live-announcement behavior matters when reusing it in a many-card diagnostic view. |
| Move-quality symbol and labelled badge | [MoveSymbol](../frontend/src/MoveSymbol.tsx), [MoveBadge](../frontend/src/MoveBadge.tsx) | One icon/label rendering path. Objective move quality and practice attempt outcomes remain different concepts. |
| White-perspective position score | [EvaluationScore](../frontend/src/EvaluationScore.tsx), [evaluation helpers](../frontend/src/evaluation.ts) | Signed pawn/mate formatting, winning-side styling and accessible perspective. Never pass side-to-move candidate scores without conversion. |
| Accuracy display | [AccuracyReadout / PlayerRow](../frontend/src/gameReview/Players.tsx) | Existing compact/summary accuracy, unavailable/completion wording and one-decimal display. |
| Practice move status | [MoveStatus](../frontend/src/MoveStatus.tsx) | Stable live region, delayed checking message and retry presentation. Do not copy its timer or imply SRS grading in other modes. |
| Motion preference field | [MotionSelect](../frontend/src/MotionSelect.tsx) | Device default / Animated / Still choices. Uses [motion policy](../frontend/src/motion.ts); its current layout CSS is application-only. |
| Account preference lifecycle | [useSavedPreferences](../frontend/src/useSavedPreferences.ts), [CoachProvider](../frontend/src/coach/CoachProvider.tsx), [MotionProvider](../frontend/src/MotionProvider.tsx) | Existing shared load/save/retry and stale-response handling. Reuse the contexts; presentation extraction does not need new storage. |
| Provider connection UI | [GameSync](../frontend/src/GameSync.tsx) | Compact Games action and expanded Settings cards use the same provider discovery/sync state. |
| Provider history import | [ProviderImportForm](../frontend/src/ProviderImport.tsx) | One data-driven form for all registered providers. Do not add separate Chess.com and Lichess forms. |
| Active/completed import jobs | [ImportJob](../frontend/src/ProviderImport.tsx) | Shared job contents with active and compact history presentations. |
| Lesson source attribution | [LessonAttribution](../frontend/src/study/LessonAttribution.tsx) | Course and illustrative-game citations, including optional license and external URL. |
| Local review tabs | [ReviewMoves](../frontend/src/gameReview/ReviewMoves.tsx) | The existing implementation has linked tab/panel IDs, roving focus and arrow/Home/End behavior. It is not yet an exported generic tabs component. |
| Native controls and visual utilities | [foundation.css](../frontend/src/foundation.css), [base.css](../frontend/src/base.css) | Button/link variants, native inputs, typography, panels, notices and action rows are currently CSS reuse. **There is no shared React Button, SectionNavigation, Pagination, EmptyState or Modal component yet.** |

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

## Standardization backlog

All items below are **open proposals**. Names in the recommendations are design
directions, not existing modules. When an item is implemented, replace its open
status with the canonical component, migrated consumers and verification record.

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
| UI-18 | [SettingsSection](../frontend/src/SettingsSection.tsx), [OpeningStudies heading/rows](../frontend/src/study/OpeningStudies.tsx), [PGN launcher](../frontend/src/Import.tsx), [Weaknesses rows](../frontend/src/Weaknesses.tsx) and [Training tools](../frontend/src/Settings.tsx) independently lay out title/body alongside actions and stack them on phones. | A small SectionHeading/ActionRow layout, if these consumers can use it without flags. Keep SettingsSection composed from it; do not turn every content card into the same data model. |
| UI-19 | [StudyScreen](../frontend/src/study/StudyScreen.tsx) and [LessonLibrary](../frontend/src/study/LessonLibrary.tsx) repeat title/subtitle/arrow resume links using shared `.study-resume`. | ResumeLink for the identical row; catalogue links, chapter command rows and game history remain separate compositions. |
| UI-20 | [Puzzle stats](../frontend/src/study/StudyScreen.tsx) and [opening stats](../frontend/src/study/OpeningStudies.tsx) repeat `<dl>` metric items with shared `.study-stats`. | A data-driven StatList is optional; current visual consistency already comes from shared CSS. |
| UI-21 | [Review](../frontend/src/Review.tsx), [LessonPlayer](../frontend/src/study/LessonPlayer.tsx), [PuzzlePlayer](../frontend/src/study/PuzzlePlayer.tsx), [OpeningLinePreview](../frontend/src/study/OpeningLinePreview.tsx) repeat `.review-position-status` and turn-dot markup. | BoardStatus / TurnIndicator preserve the existing common style. Never reveal hidden scores/source information in cold practice. |
| UI-22 | [GameHistory](../frontend/src/GameHistory.tsx) independently formats accuracy while [Players / AccuracyReadout](../frontend/src/gameReview/Players.tsx) is reused by review summary. History also independently renders names/ratings/colors. | Share the accuracy value/availability contract and, if useful, a small player-identity primitive. Retain the compact two-player history grid and row-level accessible description; do not force it into a board player row or generic table. |
| UI-23 | [LessonAttribution](../frontend/src/study/LessonAttribution.tsx), [puzzle source footer](../frontend/src/study/PuzzlePlayer.tsx), [opening source footer](../frontend/src/study/OpeningLinePreview.tsx) repeat source text and external-link conventions. | Shared source-line/link formatting where applicable, with safe protocols and explicit optional license/revision. Distinct source records and provenance stay intact. |

### Development tools and artwork internals

These count toward the audit, but should not delay the visible application fixes.
Keep their standalone dependency boundaries intact.

| ID | Evidence / mismatch | Proposed scope |
| --- | --- | --- |
| UI-24 | [CoachStudio](../frontend/src/coach/studio/CoachStudio.tsx) repeats all three motion options instead of [MotionSelect](../frontend/src/MotionSelect.tsx). | Reuse the selector after separating its shared control styling from application-only layout. Preserve the studio callback that clears simulated reduced motion. |
| UI-25 | [BoardSizePreview](../frontend/src/coach/studio/PreviewPanels.tsx) hand-renders `.evaluation-score` from strings instead of [EvaluationScore](../frontend/src/EvaluationScore.tsx). | Use typed illustrative scores and the real component. Current preview omits winning-side styling and the accessible White-perspective description, so negative samples do not match production. |
| UI-26 | [CoachSettings](../frontend/src/coach/CoachSettings.tsx) and [studio CoachPicker](../frontend/src/coach/studio/CoachPicker.tsx) separately compose portrait + name choices. They already share registry/artwork. Cast dropdown options also repeat in [PerformanceCollections](../frontend/src/coach/studio/PerformanceCollections.tsx) and [IntelligenceLab](../frontend/intelligence-lab/IntelligenceLab.tsx). | Optional shared portrait/card content and cast-option renderer. Settings' persisted native radio gallery and studio's temporary preview buttons/counts are intentionally different workflows; the lab has an extra neutral-reference option. Preserve the six-column Settings grid. |
| UI-27 | [AnimalHead/AnimalFrame](../frontend/src/coach/cast/animals/AnimalParts.tsx) and [FantasyHead/FantasyShell](../frontend/src/coach/cast/fantasy/FantasyShell.tsx) duplicate head-layer nesting and SVG/body/pose scaffolding. Head layers also appear inline in human, dog and robot artwork. | A neutral rig wrapper could own the identical nesting, with explicit class/style slots. Keep species geometry, family CSS, expression tables and hands distinct. This is internal maintenance, not a mascot redesign. |
| UI-28 | [IntelligenceLab](../frontend/intelligence-lab/IntelligenceLab.tsx) and [CoachComparison](../frontend/intelligence-lab/CoachComparison.tsx) hand-render utterance text rather than using [DialogueText](../frontend/src/dialogue/DialogueText.tsx). | Optional shared non-live text/metadata rendering, composed into the current production live paragraph and diagnostic layouts. Preserve lab `<dd>` semantics and avoid announcing every comparison card. |
| UI-29 | Checkbox rows in [CoachStudio](../frontend/src/coach/studio/CoachStudio.tsx), [IdlePlayback](../frontend/src/coach/studio/IdlePlayback.tsx), [PerformanceCollections](../frontend/src/coach/studio/PerformanceCollections.tsx), [CoachComparison](../frontend/intelligence-lab/CoachComparison.tsx) and [IntelligenceLab](../frontend/intelligence-lab/IntelligenceLab.tsx) use separate `.studio-reduced`, `.studio-toggle` and lab inline styling. | Low-priority CheckboxField/row convention for label and target geometry. Keep the distinct effects of each checkbox in its caller; importing settings CSS is not an acceptable shortcut. |
| UI-30 | [AnimalEyes](../frontend/src/coach/cast/animals/AnimalParts.tsx), [AnimalFace](../frontend/src/coach/studies/AnimalFace.tsx) and [FantasyFace](../frontend/src/coach/cast/fantasy/FantasyFace.tsx) repeat clipped gaze and open/closed eye mechanics around different art. | Optional mechanics-only extraction if inspection shows it simplifies those consumers. Eyelid curves, highlights, pupils, dimensions and expression poses are authored art; this is not a mandate to unify the faces. Lower value and higher visual risk than the identical wrappers in UI-27. |

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
  DialogueText announces the current in-game utterance. Reusing its text/metadata
  formatting would need a non-live mode; do not announce every comparison card.
- **Native fields and disclosures:** Native select, radio, label, details and
  progress elements are already reusable browser behavior. Introduce components
  for actual common contracts, not to eliminate all native JSX.

## Proposed implementation order — owner discussion pending

1. **Selector foundation:** UI-01 first. Recommendation: the compact footprint of
   Openings with a clear accent selected state, consistent target height and one
   responsive treatment. Apply it to both screenshots together. Reuse its visual
   tokens for real tabs/local choices without changing their semantics.
2. **Action/control foundation:** UI-03 through UI-07 and modal lifecycle UI-16.
   Standardize dimensions, purple return actions, navigation and focus behavior.
3. **Feedback and page states:** UI-08 through UI-13, then provider/form fragments
   UI-14/15 and disclosure conventions UI-17.
4. **Small markup and tooling gaps:** UI-18 through UI-30 where the extraction is
   demonstrably simpler than the current consumers. Keep optional items optional;
   don't manufacture a large design-system framework to close the table.

The immediate audit/documentation pass changes no JSX, CSS, component behavior,
schema or engine policy. UI choices above await discussion with the owner.
