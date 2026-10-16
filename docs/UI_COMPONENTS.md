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
   variants explicitly. Avoid selectors such as unscoped `nav` or `main` that make unrelated
   components inherit another component's layout. Page and shell stylesheets only
   place a component (width, flex, grid, margins); its size, type and colour
   variants live in the component's own stylesheet. The shell's page frame and
   its phone typography defaults use zero-specificity `:where()` scoping, so a
   component's own rule always wins.
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
| URL section navigation | [SectionNavigation](../frontend/src/SectionNavigation.tsx), [section-navigation.css](../frontend/src/section-navigation.css) | Settings, Lessons (Fundamentals / Openings / Catalogue / My studies), Puzzle sources and Insights (Overview / Weaknesses) share the framed tray. Optional `subsections` add a second level for the current section inside the same tray (Insights → Weaknesses: Tactical patterns / Material & mate), after a divider on desktop and as a second row on phones; it is its own labelled `nav`, keeps 44px targets and marks its current link with an underline only, so the section's filled tab stays strongest. Do not stack a second tray under the first. Callers supply destinations, selected ID and accessible name; account/course/category filtering remains caller-owned. Weakness categories use bookmarkable query routes and reuse loaded evidence across category changes. |
| Local single choice | [ChoiceGroup](../frontend/src/ChoiceGroup.tsx), [choice-group.css](../frontend/src/choice-group.css) | PGN source, puzzle difficulty, puzzle goal, Play setup, the opening line's Study as (each side with its decision count) and Studio filters share rectangular pressed buttons. Each option is a secondary Button with `aria-pressed`, so the chosen one shows Button's pressed state. Controlled value/options/callback; an option can be disabled (Play's engine cannot match a human level; Human-like is unavailable without the human move model); no route or tab semantics. Caller owns input clearing and filtering. `phone="select"` shows the same choice as a native select on phones (Insights' Speed and Period filters), so long option sets stay on one line; the phone breakpoint comes from the shared [usePhone](../frontend/src/usePhone.ts) hook. `showLabel` shows the `label` as the choice's visible label and names the group (or phone select) by it through `aria-labelledby` with an id of its own, so pages write neither the label nor an id: it stacks above the options in bold (Play setup, puzzle filters, the opening line's Study as) and, in the compact toolbar row, is a small-caps caption beside them that stacks on phones (Insights). `size="compact"` is the denser row for toolbars (Insights' filters): compact Buttons that keep the ordinary 13px type and 16px side padding, and stay 36px at every width; pages do not resize its buttons themselves. |
| Commands and button-styled destinations | [Button / IconButton](../frontend/src/Button.tsx), [ActionLink](../frontend/src/ActionLink.tsx), [action-controls.css](../frontend/src/action-controls.css) | Ordinary/compact/dense/toolbar sizing, primary/secondary/quiet variants, square labelled icons and 44px phone targets. This is the only button look: foundation.css resets `button` to a bare element (no border, fill or padding) and draws nothing else, so a raw `<button>` that is not a Button must style itself completely in its own component (ReviewMoves' tabs and move list, the Maia insight trigger, the lesson editor's step list and the coach studio's coach and expression tiles). Button defaults to type=button; forms must request submit. ActionLink retains Link semantics. Native disabled and aria-disabled stay independent. Containers own width/placement. ActionLink adds only the action-control classes; the legacy `.primary`, `.secondary`, `.text-button` and `.icon-button` classes are gone, and the studios use Button too. Heights come from `--control-height` (42px), `--control-height-compact` (36px), `--control-height-dense` (28px) and `--touch-target` (44px) in foundation.css. `size="toolbar"` is compact on desktop and narrower on phones (6px padding, 11px type, still 44px tall), so a full row of board controls fits (Play's Resign and New game); a toolbar icon is 36px square on desktop, like compact. Two flags change only type and alignment: `mono` sets the notation's mono type for move buttons (variation moves, ContinuationMoves), and `spread` puts the label and trailing icon at opposite ends of a full-width Button (Due's Study openings and, when practising one skill, Return to mixed review; the studio's collection links). `size="dense"` is for chrome inside game review's notation panel: Next mistake and Export are dense quiet Buttons in the notation header, and variation moves are dense mono Buttons. Dense, like ordinary and compact Buttons by default, reaches 44px on phones, and a dense icon is 28px square (44px on phones). A quiet Button has no side padding at any size. A toggle Button sets `aria-pressed`; when it is on, Button draws the one pressed state (accent border and text on the raised fill; a quiet Button turns its text accent), used by ChoiceGroup options, variation moves, the mute button, Explain's finding links and the studio's collection links. A surface with its own palette sets `--pressed-border`, `--pressed-background` and `--pressed-color` rather than writing its own pressed rule (the coach bubble's Hide why and Play's Show book, which sits among the coach's actions, keep its green). |
| Return from exploration | [ReturnButton](../frontend/src/ReturnButton.tsx) | Canonical purple action and return icon for game variations and lesson branches/full games. Caller supplies label, disabled state and command; long labels can wrap on narrow phones. |
| Paged destinations | [Pagination](../frontend/src/Pagination.tsx) | Catalogue Previous/range/Next layout for Games and opening catalogue. Callers supply counts and destination URLs; unavailable directions are disabled buttons. |
| Resume/continue row | [ResumeLink](../frontend/src/ResumeLink.tsx) | Existing raised title/subtitle/arrow destination row for saved lessons, puzzles, course lines and Home's practice priorities. Callers supply destination and content; chapter commands remain separate. |
| Study statistics | [StatList](../frontend/src/StatList.tsx) | Shared definition-list markup and metric appearance for puzzles, opening studies, weakness cards and Home; callers supply labels/values and visibility. Featured prominence supports a primary dashboard count without page-specific number styles. Do not duplicate counts as page-specific statistic markup. |
| Move playback controls | [MovePlaybackControls](../frontend/src/MovePlaybackControls.tsx) | Labelled previous/counter/next group, optional first/last, stable digits and canonical lesson geometry. Callers own navigation and separate flip/back controls; disabled and aria-disabled remain independent. It also binds the page keys to its buttons through usePageShortcuts: Left/Right (and Chess.com's A/D) press previous/next, and Up/Down (Chess.com's) and Home/End press first/last where it shows them; the buttons announce their keys with `aria-keyshortcuts`; a key does nothing while its button is disabled or aria-disabled. Every mounted playback group therefore has the same keys (game review, Play, lesson game playback, opening line preview, the practice continuation, a solved puzzle's solution). |
| Page keyboard shortcuts | [usePageShortcuts](../frontend/src/usePageShortcuts.ts) | The one window-level key listener and its guards: ignores Ctrl/Alt/Meta chords, yields while a `:modal` or `:popover-open` element exists (they own Escape and focus; a leaving `data-ghost` copy does not count), and ignores keys typed in inputs, selects, textareas and contenteditable. Bindings are ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Home, End, Escape and the letters A, D and X (matched in either case). When several owners bind a key, the most recently opened one handles it, so a panel opened over a page (the practice continuation) takes the keys while it is open. [FlipBoardButton](../frontend/src/FlipBoardButton.tsx) is the shared Flip board control (game review and Play) and binds X, Chess.com's flip key. Pages bind only Escape (game review: close the explanation, else return from a variation to the game; Play: close the explanation; practice continuation: close it); arrows, A/D, Up/Down and Home/End come from MovePlaybackControls and X from FlipBoardButton, so keys always match the visible buttons. Chess.com's Z (focus mode) and Alt-while-promoting (no auto-queen here) have no matching feature. Element-level keys (ReviewMoves tabs, EvaluationGraph points) stop propagation and win while focused. Do not add another window keydown listener for page navigation. |
| Selectable continuation | [ContinuationMoves](../frontend/src/ContinuationMoves.tsx) | Compact mono Buttons at the ordinary 13px (set in continuation-moves.css, the component's own move size); the selected occurrence (`aria-current="step"`) gets the accent border. Start/SAN controls, optional move numbering, explicit selected occurrence and playback-disabled state. Callers own inspection; full-game scored notation stays separate. |
| Ordinary page heading | [PageTitle](../frontend/src/PageTitle.tsx) | Visually hidden page `h1` only. Owner decision, October 12, 2026: pages show no visible header (no eyebrow, title or header row), because the navigation already names the page; the hidden heading keeps screen-reader and heading navigation. Page actions are ordinary page content: Games puts its Update games control (`GameSync compact`, compact size with a refresh icon) in the game list's own header row beside the game count (GameHistory's `toolbar`), and in the empty state's actions when there are no games, so it never floats alone above the page. Do not reintroduce a visible page title or eyebrow. Compact board-workspace headings remain a separate use case. |
| Settings section | [SettingsSection](../frontend/src/SettingsSection.tsx), [settings.css](../frontend/src/settings.css) | Labelled section, heading, optional description/actions and consistent spacing. Currently application/Settings-specific. `settings-tool settings-tool-row` is the shared list row whose commands are a wrapping group of compact buttons, used by Courses ([CourseSettings](../frontend/src/study/CourseSettings.tsx)) and administrator account management ([AccountAdmin](../frontend/src/AccountAdmin.tsx), shown under Settings → Account to administrators only). Destructive row commands use the inline two-step confirmation (quiet Delete, then a secondary confirm and quiet Keep it) rather than a dialog. `stackActions` puts a row of several section commands under the heading on phones (Courses). The shared checkbox row is `.check-row` in settings.css (Sound, Server and the lesson editor's "Members can add it to Due"); each use sets its own alignment and height. |
| Board rendering and interaction | [Board](../frontend/src/Board.tsx), [board.css](../frontend/src/board.css) | Legal destination markers, tap/drag, promotion, highlights, piece motion, quality markers and arrows. Backend-supplied legality remains authoritative. Callers may give arrows a `#rrggbbaa` colour; Board draws it opaque and fades the whole arrow by that alpha (times the library's 0.65), so a faded stem never darkens where it runs under the head. Every board also takes Chess.com's own annotations (owner decision, October 14, 2026): right-click marks a square red, Shift+right-click green, Ctrl/Cmd+right-click yellow and Alt+right-click blue (`data-mark`, colours in board.css); the same click again removes the mark and another colour replaces it. Right-drag draws the library's arrows in Chess.com's colours (yellow, Ctrl red, Shift green, Alt blue). A left click on a square clears marks and drawn arrows, and both clear when the position changes. The board suppresses the browser's context menu. Marks are visual only and never reach callers. |
| Game export | [GameExportDialog](../frontend/src/gameExport/GameExportDialog.tsx), [gameGif](../frontend/src/gameExport/gameGif.ts) | One dialog for PGN (copy/download), FEN (copy; the position on the board) and an animated GIF made in the browser from the board's own pieces and colours. It reads `/api/games/{id}/export`, uses useModalDialog, and loads the GIF encoder (gifenc) only when asked; closing the dialog stops a GIF still being drawn. Downloads go through the shared `download` helper ([download.ts](../frontend/src/download.ts)), as course files do. Game review opens it from an icon-only button in ReviewMoves' optional `actions` slot beside Next mistake, shown on both tabs. The game lists have no export button (owner decision, 2026-10-12). |
| Native modal lifecycle | [useModalDialog](../frontend/src/useModalDialog.ts) | Evidence and promotion share native opening, Escape dismissal, keyboard isolation and connected-opener restoration. Promotion supplies board fallback and board-relative placement; Maia remains non-modal. Their presentation (surface, backdrop, full-height phone sheet within the safe areas, and the page scroll lock while any modal is open) is [dialog.css](../frontend/src/dialog.css), shared by evidence and export; each dialog keeps its own width and inner layout. |
| Native disclosure styling | [disclosure.css](../frontend/src/disclosure.css) | Apply disclosure to native details, retaining browser-owned toggling and markers. Shared summaries have 44px minimum targets; rich import history retains its content layout. The audio studio reuses these shared-safe rules for sources and playback history. |
| Board/sidebar layout | [ReviewWorkspace](../frontend/src/ReviewWorkspace.tsx), [review-presentation.css](../frontend/src/review-presentation.css) | Shared board sizing and slots for status, evaluation, controls and sidebar; mobile coach placement. |
| Board turn indicator | [TurnIndicator](../frontend/src/TurnIndicator.tsx) | Decorative color dot with caller-supplied status text. Due, lessons and puzzles retain their distinct status and visibility rules. |
| Coach bubble, portrait and action geometry | [ReviewCoach](../frontend/src/ReviewCoach.tsx), [coach-presentation.css](../frontend/src/coach-presentation.css) | Shared title, badge, evaluation, explanation, detail, insight, caption and actions. The action row (Show why, Return to game) is 40px tall at every width, a deliberate exception to the 44px phone target (owner decision, 2026-10-12). One shared height (136px desktop, 156px narrow) holds the title, about three lines of explanation and the footer; longer lines, including a joined spoken line, scroll inside the message, which never shrinks below two lines. The footer sits outside the scrolling message: an optional `detail` line (game review's opening name) and the Maia insight share one row when they fit and wrap otherwise, so neither is clipped, ellipsized or scrolled away. `compactLabel` fits the title row to its text for modes with no evaluation or voice control (lessons). Preserve stable portrait identity and message-scroll reset behavior. Optional speech playback goes to the shared avatar; a custom character owns its own handle. The Play setup page uses ReviewCoach on phones (without an action row, which is optional) and differs only on desktop: its large standalone portrait has a single line above it, with no actions or fixed review height, so it does not use ReviewCoach; that standalone bubble (`play-setup-speech`) is styled in coach-presentation.css with the bubble colours and the `coach-label`/`coach-message` classes, and play.css only places it (`.play-setup-coach`). Play's opening practice asks its questions (Take back / Play on, Keep playing / Go again) inside this bubble through PositionCoach's optional `prompt`, which replaces the line and actions until answered, rather than in a separate notice; its optional `extraAction` adds "Show book" beside the coach's own actions. `fit="content"` sizes the bubble to one short line that never changes (Play setup on phones). The narrow layout is written for phones and for any column 440px or narrower (the desktop review sidebar and the coach studio's compact preview); only phones also shrink the title and score badge. |
| Registered coach artwork/performance | [CoachAvatar](../frontend/src/coach/CoachAvatar.tsx) / [CoachCharacter](../frontend/src/coach/CoachCharacter.tsx), [registry](../frontend/src/coach/registry.ts) | App-selected avatar versus explicit preview character. CoachCharacter is its own provider-free module, so tools and previews that render it never load the coach preference provider. Use registry metadata; do not maintain another cast list. Speech-capable rigs reuse `useSpeechPerformance` and the audio engine's live clock; optional `SpeechMouthTrack` uses shared semantic shapes, not tool-specific IDs or per-page talking timers. `HumanFeatures` has an optional mouth slot with its exact authored fallback. The studio's two-portrait comparison composes this same character instead of duplicating a review bubble. |
| Speech mouth layers | [SpeechMouthLayer / OrganicSpeechMouth](../frontend/src/coach/SpeechMouthLayer.tsx), [speech-mouth.css](../frontend/src/coach/speech-mouth.css) | The layer preserves exact authored mouth artwork when silent or Still and cross-fades between the two mouths when a line starts or ends; a developer's explicit held-shape preview is static inspection. Organic mouths share geometry driven by the existing speech controls, including distinct round/puckered shapes, aspect compensation and a common moving interior clip. Species own placement, palette, mood (or an explicit upper-lip curve for a mouth drawn along a seam, as Fergus's is) and optional teeth/fangs/tongue/interior; mechanical mouths can reuse only the layer. Do not add per-artwork clocks or cue timing. Walter retains his existing dedicated rig. |
| Authored SVG rig layers | [ArtworkRig](../frontend/src/coach/ArtworkRig.tsx) | Decorative SVG frame and identical study body/head layers. Keep species art, CSS, poses, viewBoxes and accent placement with their family. Classic's distinct rig remains separate. |
| Rendered coaching text | [DialogueText](../frontend/src/dialogue/DialogueText.tsx) | Supported utterance text and intent/variant metadata. Production defaults to a polite paragraph; lab previews explicitly use announce=false and optionally as=dd for definition lists. |
| Coach's spoken line as bubble text | [useSpokenText / useSelectedCoachSpokenText](../frontend/src/audio/speech/spokenText.ts) | The coach's recorded line for a selected meaning, else its script line; null while loading or unknown, so callers keep their written text. Callers keep selecting the meaning (gameSelection/practiceSelection) and replace only a 1:1 coach sentence; DialogueText's optional `recordingId` marks the replacement as `data-spoken`. Scripts load lazily per coach. |
| Game review moves line | [CoachMovesLine](../frontend/src/gameReview/CoachMovesLine.tsx) | Facts read from report/position data only (never prose). The opening name renders in ReviewCoach's `detail` slot only while the bubble shows a spoken line; it wraps rather than truncating and is not a separate live region. The engine's strongest reply (never the move played) renders as **Reply** under **Best** in the portrait caption, matching the board's faded blue reply arrow; the screen-reader announcement keeps `<Side>’s strongest reply: <SAN>` and its claim-proven qualifier. Game-review specific; other modes keep their own concrete text. |
| Move-quality symbol and labelled badge | [MoveSymbol](../frontend/src/MoveSymbol.tsx), [MoveBadge](../frontend/src/MoveBadge.tsx) | One icon/label rendering path. Objective move quality and practice attempt outcomes remain different concepts. `size="small"` is the variation-row badge and `size="inline"` takes the size of the surrounding text (the review summary table); pages only place the badge. |
| White-perspective position score | [EvaluationScore](../frontend/src/EvaluationScore.tsx), [evaluation helpers](../frontend/src/evaluation.ts) | Signed pawn/mate formatting, winning-side styling and accessible perspective. Never pass side-to-move candidate scores without conversion. `size="compact"` is the smaller reading beside the evaluation graph. |
| Accuracy display | [AccuracyReadout / PlayerRow](../frontend/src/gameReview/Players.tsx) | Player, summary and passive history presentations share unavailable/completion wording and one-decimal formatting. History keeps its row-level accessible description. A game in progress omits the `accuracy` prop and reserves no readout. PlayerRow also shows a side's PGN clock at the selected position through its optional `clock` prop; games without clocks omit it. |
| Library insights | [GameInsights](../frontend/src/GameInsights.tsx), [game-insights.css](../frontend/src/game-insights.css) | Insights → Overview only. Composes ChoiceGroup filters, StatList, LoadState, EmptyState, Link and GameHistory's `OutcomeBadge`; its recent-games list gives the badge a fixed 38px width (game-insights.css) so the result column lines up, where GameHistory's rows place the badge in a table cell or footer that already aligns it; its bar, split and heatmap marks are local because no other screen charts aggregates. Promote them before a second consumer copies them. |
| Saved game list | [GameHistory](../frontend/src/GameHistory.tsx), [game-history.css](../frontend/src/game-history.css) | Shared dates, player rows, outcomes, passive accuracy and review links. Games uses the default comparison table, adapting to its container width. Home uses explicit compact presentation: full-width player/score rows and a wrapping result/time/date/accuracy/review footer, without column headings or striping. Inside a panel, compact rows bleed into the panel's side padding so the dividers and hover highlight span the card while the text stays aligned with the heading; flat phone panels have no padding, so nothing bleeds there. Move count remains in the accessible description and the full library. The library presentation takes an optional `toolbar` drawn as the list's first row inside its border (flat on phones); Games puts its game count and Update games there. All variant styles live with GameHistory; callers own fetch limits, enclosing panels, toolbar content and pagination. |
| Practice move status | [MoveStatus](../frontend/src/MoveStatus.tsx), [move-status.css](../frontend/src/move-status.css) | Stable atomic live region, 350ms delayed checking and retry presentation. Optional rich content retains lesson paragraphs; do not pass general playback/navigation busy state as move grading. |
| Saved recall receipt | [RecallReceipt](../frontend/src/srsReview/RecallReceipt.tsx) | Relative next-due text with exact date/time tooltip. Callers supply scheduling explanations and whether a due time applies; cold positions render no receipt. |
| Motion preference field | [MotionSelect](../frontend/src/MotionSelect.tsx), [motion-select.css](../frontend/src/motion-select.css) | Device default / Animated / Still choices in Settings and Studio. Inline or stacked layout; callback and persistence stay caller-owned. Shared-safe styles; Settings status/layout remains in application-only motion.css. |
| Account preference lifecycle | [useSavedPreferences](../frontend/src/useSavedPreferences.ts), [CoachProvider](../frontend/src/coach/CoachProvider.tsx), [MotionProvider](../frontend/src/MotionProvider.tsx) | Existing shared load/save/retry and stale-response handling. The hook owns the write queue: writes run one at a time, changes saved while one is in flight wait merged (each field's latest choice wins), and `save` resolves `saved`, `superseded` (replaced by a later choice or a reload before it was written) or `failed`. A reload clears `saving`. Settings controls stay enabled while saving (`aria-busy`) and are disabled only until the preferences load. An optional `deviceCache` remembers the loaded preferences on the device per account under `fieldwork.<name>:<account id or "local">` (AudioProvider's mute key uses the same scheme); CoachProvider uses it for the coach and MotionProvider for interface motion, and guests never write it. A cache's `legacy` key (the device-wide `fieldwork:coach-id` and `fieldwork.interface-motion` from before per-account caches) seeds the first signed-in or local account that reads its cache with none of its own, and is then removed; a guest never consumes it. Reuse the contexts; presentation extraction does not need new storage. |
| Audio preferences and playback | [AudioProvider / useAudioScope](../frontend/src/audio/AudioProvider.tsx), [AudioSettings](../frontend/src/audio/AudioSettings.tsx), [AudioMuteButton](../frontend/src/audio/AudioMuteButton.tsx) | Reuses account preference persistence. Quick device mute is the last control inside each board-controls group (game review puts Flip at the start of the row and mute at the end, either side of the move controls), so it shares that group's sizing, spacing and shrink rules; the workspace renders it alone only when a page has no board controls. Session/playback handlers send explicit semantic events through scoped controls. Do not add Audio instances, FEN-driven sound effects, coach-expression audio or separate page sound schedulers. See [Audio](AUDIO.md). |
| Development studio playback | [useStudioPlayer](../frontend/src/audio/studio/useStudioPlayer.ts), [StudioTransport](../frontend/src/audio/studio/StudioTransport.tsx), [StudioReviewPanel](../frontend/src/audio/studio/StudioReviewPanel.tsx) | Shared player and transport for the audio studio's Walter wording review and recorded coach comparison, which also share one review shell, speaking-coach preview and grouped select (StudioReviewPanel); development-only, never imported by the application. The studio's sections and transport draw the shared `.panel` surface from panel.css (the surface and its phone policy, loaded by the application and the audio studio) rather than redrawing it, and keep their frames on phones as cards (`panel--card`, listed in scripts/surfaces.json); base.css's application-only stacking and bare-action rules do not reach them. The coach studio's framed controls, concept, idle bar, comparison and context cards (coach/studio/studio.css, idle-playback.css) are its own studio look, with larger radii and its green palette, not copies of `.panel`, so they keep their own surfaces. The cast audition and casting-choice components were removed on 2026-10-03 once casting finished. |
| Recorded coach voice | [useCoachSpeech](../frontend/src/audio/speech/useCoachSpeech.tsx), [CoachSpeechButton](../frontend/src/audio/speech/CoachSpeechButton.tsx) | Supply supported recording IDs and fresh action identity. ReviewCoach owns the shared voice control beside its evaluation; explicit secondary explanations reuse CoachSpeechButton. Keep cold prompts manual, lessons silent and replay cancellation scoped. Mouth animation observes the existing speech clock, never a separate page timer. |
| Preference save feedback | [PreferenceStatus](../frontend/src/PreferenceStatus.tsx) | Shared saving/error/loading/saved/idle precedence, retry action and reserved line. Heading or field placement; persistence and saved flags stay with the caller. |
| Errors and session starts | [CommandError / QueryError / useCommand](../frontend/src/useQuery.tsx), [useSessionStart](../frontend/src/useSessionStart.ts) | One error channel: every failure that is not a first load (QueryResult shows those) is the page's error banner. A command's failure renders through `CommandError` from any `{ error, dismiss }` source (useCommand, useSessionStart, a session hook); code that reports a failure calls `fail(e: unknown)` (useCommand's or a session hook's), never passes a message string, and there is no app-level `fail` prop. A side request whose failure leaves the page usable (Play's measured level, game connections, the engine's status, Study's counts) renders `QueryError`: "Couldn’t load {label}." or "Couldn’t refresh {label}." with Try again. Starting a lesson, puzzle, practice or Play session and opening it goes through `useSessionStart` (one start at a time, the retryable request id kept until acknowledged, a `none` handler when nothing matches). Lessons and puzzles share `useStudySession` for their load, one-command lock and reconcile-on-failure rule. In-place notices that belong to a control (a provider sync result, the coach bubble) stay where they are. |
| Pending/unavailable content | [LoadingState / UnavailableState](../frontend/src/LoadState.tsx), [QueryResult](../frontend/src/useQuery.tsx) | Compact/panel states with message-only announcements and separate caller-supplied headings/actions. `QueryResult` renders a `useQuery` request: LoadingState while nothing has arrived, UnavailableState with Try again when the first load failed, and its children only once the data is here (a later refresh that fails keeps them and adds an error banner with Try again); an EmptyState belongs inside the children, so "you have nothing" is never shown for a load that failed or has not finished. `useQuery`'s `enabled: false` holds a request a screen does not need yet (Weaknesses waits for its tab, the provider import form for a saved username it was not handed). A request that repeats on a schedule uses `usePolledQuery`, which wraps `usePolling` in the same shape so QueryResult renders it (import activity, Play's measured level); its repeat reads are silent and an outage is one refresh banner. QueryResult keeps loaded children through a dependency reload; a screen whose filters or search change what is shown adds `QueryReloading` (the compact LoadingState, only during that reload) and marks the kept content `reloadable` with `data-reloading={reloading(query)}` so it dims until the new result arrives (Insights filters, opening catalogue search). A screen whose route names another item (another games page, course or line) is keyed by it, so it loads fresh behind its own LoadingState. Messages are always "Loading {label}…" and "Couldn’t load {label}." with Try again; screens that own a session lifecycle (a Play game, game review, lessons, puzzles, Due) keep their hook but use the same words (adding the server's reason after "Couldn’t load …", since a missing game or session says why), and page-level loaders use the panel presentation. LoadingState leads its message with a small animated board (four squares lighting clockwise, decorative and hidden from assistive technology) that rests as a checkerboard when interface motion is off; UnavailableState has no indicator. Plain `role="status"` loading paragraphs (Games, game connections, import providers, onboarding connections and the sign-in check) use it too; only the coach bubble's continuation line and preference save status keep their own text (owner decision, October 15, 2026, once AccountGate left the studios' bundles). Requests, recovery commands and link destinations remain with each screen. |
| Content entrances and exits | [Reveal / RevealList / Swap](../frontend/src/Reveal.tsx), [DialogPresence](../frontend/src/DialogPresence.tsx), [disclosureMotion](../frontend/src/disclosureMotion.ts), [usePopoverExit](../frontend/src/usePopoverExit.ts), [reveal.css](../frontend/src/reveal.css) | `<Reveal>{condition && <Block />}</Reveal>` grows a block in and collapses it out (every conditional Notice uses it); `RevealList` does the same for keyed rows added or removed after the list settles (`exit={false}` drops leaving rows at once); `Swap` crossfades one keyed child into another while the size morphs (Settings tabs, inline editors, confirms, status text). Leaving content is swapped for a decorative copy (ghost.ts: no live components, controls, ids, roles or text nodes; CSS draws its words) that fades away, so queries and assistive technology only see what is really there. A copy keeps the values its fields showed (inputs, checkboxes, textareas and selects) and is marked `data-ghost` (Reveal marks the `.reveal-clip` holding it), so its descendants do not replay their own entrances. DialogPresence closes a modal at once while such a copy plays its close, disclosureMotion animates every `<details>` both ways, and usePopoverExit fades a hidden popover out (DialogPresence and usePopoverExit both play their copy through ghost.ts's `playLeavingCopy`). All use grid tracks or WAAPI, so every browser behaves the same. Application-only; see [Motion](#motion). Play setup's `.play-swap` (play.css) is a recorded exception: its alternatives share one grid cell and crossfade without a size change, because the setup form must not move when the opponent changes (Swap morphs the size). |
| Empty content | [EmptyState](../frontend/src/EmptyState.tsx) | Lessons/Puzzles presentation for full sections, with compact activity/search variants. Callers supply titles, descriptions, icons and recovery actions. Show it only for data that loaded and is empty (QueryResult's children), never while a load is pending or failed. Due's start panel (srsReview/ReviewPanel.tsx, "Build your study queue") is a recorded exception: it fills the board workspace's sidebar beside the board, with a full-width action column and a note, which the centred section does not offer. |
| Page banners | [Banner / BannerProvider / BannerOutlet](../frontend/src/Banner.tsx), [banner.css](../frontend/src/banner.css) | Owner decision, October 14, 2026: every short-lived page message is a banner in one slot at the top of the page, never a page-specific notice and never a toast floating over the content. BannerOutlet is the first block of `main`, so every page shows them in the same place. `{message && <Banner tone onDismiss action>…</Banner>}` shows while mounted; the caller keeps the message state and onDismiss clears it. A banner belongs to its page: one still up when the page changes goes at once instead of collapsing above the next page, and an error leaves with the screen that raised it (Settings drops its errors when its section or import source changes). The slot's space below opens and closes with its first and last banner. Confirmations close themselves after six seconds (paused while hovered or focused), counted from when the message last changed rather than from the owner's last render; errors and banners with an action stay until closed. A banner republishes to the slot only when what it shows changes. Each banner is a Notice with the `banner` appearance: compact, with a tone stripe; message, action and close button share one row when they fit, and on narrow screens the action wraps under the message while the close button stays on its row. Commands in it are 36px on phones. Errors render through CommandError and QueryError (see Errors and session starts). Used for welcome-back, Play's result, errors and engine stand-in note, game review errors, Study and lesson start errors, the next-puzzle error, opening-line errors, import queued messages, connection errors, and Settings' account, server, course and lesson-editor confirmations and errors. Lasting state stays an in-page Notice: a game in progress, load failures that leave a section empty, a locked lesson or puzzle session, import history, failing course files and the lesson editor's live check. Sign-in screens keep their inline errors (made an exception while AccountGate was in the studios' bundles; it no longer is, and the exception awaits the owner's decision). |
| Notices | [Notice](../frontend/src/Notice.tsx), [notice.css](../frontend/src/notice.css) | Explicit alert/status/passive policy, tone, panel/inline/banner presentation, separate actions and an optional `onDismiss` close button. A panel with actions centres its text on them. Historical import errors remain passive; persistent live regions can stay mounted empty without blank spacing. Shared-safe presentation also serves studio availability and playback feedback without importing application layout. [WelcomeBack](../frontend/src/WelcomeBack.tsx) and the Settings analysis-queue line use it too; the welcome-back import link sits in the body so narrow screens keep the text full width. |
| Provider connection UI | [GameSync](../frontend/src/GameSync.tsx) | Compact Games action and expanded Settings cards use the same provider discovery/sync state. |
| Provider username | [ProviderUsernameField](../frontend/src/ProviderUsernameField.tsx) | Shared native rules, unique labels/help IDs and 50-character limit. Optional connection/onboarding versus required import and busy/draft state remain caller-owned. |
| Provider history import | [ProviderImportForm](../frontend/src/ProviderImport.tsx), [ImportSettings](../frontend/src/Import.tsx) | One data-driven form for all registered providers. ImportSettings owns the shared title/Close row and cancellable exit for provider and PGN forms. Both use imports.css for aligned fields, an action footer and matching 450ms layout expansion/collapse governed by the existing interface-motion preference. A persistent grid shell animates the occupied height; do not reserve full height before fading the form. Still closes immediately; closing forms are retained and inert until the transition ends, and reopening reverses the transition without losing drafts. Do not add separate provider forms or nested panel/toolbar shells. |
| Import submit action | [ImportControls](../frontend/src/ImportControls.tsx) | Shared `ImportSubmitButton` label/icon/busy presentation for the PGN and provider forms. Imports have no analysis option, since every saved game is analyzed automatically. PGN matching, provider filters and request payloads remain caller-owned. |
| Active/completed import jobs | [ImportJob](../frontend/src/ProviderImport.tsx) | Shared job contents with active and compact history presentations. |
| Server settings | [ServerSettings](../frontend/src/ServerSettings.tsx) | Administrator-only (or the single local user) Settings → Advanced section for the settings stored in `site_settings`. Reuses SettingsSection, the settings-tool row with compact Buttons for Restart (inline confirm, like account delete), the shared `disclosure` per group and Notice. Fields are native inputs, selects and checkbox rows styled in settings.css (`server-settings-*`), following Sound's checkbox-row geometry; the form is generated from the server's field list, so it adds no per-setting markup. |
| Lesson editor | [LessonEditor](../frontend/src/study/LessonEditor.tsx) | Administrator-only course editing at `/settings/courses/editor`, reached from the admin-only Settings → Courses section ([CourseSettings](../frontend/src/study/CourseSettings.tsx), which reuses SettingsSection and the settings-tool rows). Composes ReviewWorkspace (board left, scrolling form right), Board for recording moves with server-supplied legal moves, ChoiceGroup for side, section, board view and chapter choices, native details/select/inputs for fields, and Notice for the live check's course problems; when the check request itself fails, a page Banner with Try again says so and the last good board stays. Renaming a step re-points other steps' links (`next`, `branch`, each choice's `next`, the chapter entry), and renaming a line re-points the rehearsal steps that replay it, when the id field is left or Enter is pressed, not per keystroke; a chapter id commits the same way. An id that is empty or already taken is refused with a banner and the field shows the old id. Deleting a step makes links to it carry on to the next step (a side trip or entry that named it is cleared), and deleting a line leaves its rehearsal steps asking for a line, so no link names something that is gone. A step is marked as having the live check's problem from the check's structured `location` (chapter and step ids), never by reading the message. The editor is split into its course state and board ([LessonEditor](../frontend/src/study/LessonEditor.tsx)) and one component per section under [lessonEditor/](../frontend/src/study/lessonEditor/), with the file model and renames in `model.ts`. After a save the address names the saved course and revision, so a reload opens it. Its heading is one row: the quiet *Courses* back link, the title (which shortens) and Save, so Save always fits. It edits the course file directly, so fields it does not show are kept. The step list's selectable rows are local to the editor because no other screen lists editable steps. |
| Source attribution | [SourceLine](../frontend/src/SourceLine.tsx), [LessonAttribution](../frontend/src/study/LessonAttribution.tsx) | Shared text, optional license/revision and valid absolute HTTP(S) source/license links. Optional licenseUrl links the existing license label separately from View source. LessonAttribution resolves Repository license at render time without changing saved course fingerprints. Lesson sources remain multiple records; puzzle provenance remains completion-only. The audio studio uses SourceLine for recording credits; source-line.css is shared-safe. |
| Local review tabs | [ReviewMoves](../frontend/src/gameReview/ReviewMoves.tsx) | The existing implementation has linked tab/panel IDs, roving focus and arrow/Home/End behavior. An optional `actions` slot holds whole-game commands beside Next mistake on both tabs (game review's Export). It is not yet an exported generic tabs component. It accepts any navigator with the exploration fields it reads, so the live game shares the notation and quality tabs. |
| Native controls and visual utilities | [foundation.css](../frontend/src/foundation.css), [base.css](../frontend/src/base.css), [panel.css](../frontend/src/panel.css) | Specialized native controls, typography, panels and action rows retain CSS foundations. foundation.css also owns the [spacing scale](#spacing), the [type scale](#type), the [motion scale](#motion) and the `.stack` / `.cluster` layout primitives. Use the named components above for ordinary actions, notices, pagination and empty states; native dialogs share useModalDialog. |

Quick mute belongs to each page's board-controls group rather than trailing it,
so it never wraps onto its own row or keeps a different size from its neighbours.
The cold SRS toolbar contains only that mute control; it is not an empty row to hide.

## Spacing

Every margin, padding and gap in every stylesheet (application, studios and lab)
uses the spacing scale defined in [foundation.css](../frontend/src/foundation.css).
Owner decision, October 11, 2026: one scale and container-owned spacing across
the whole site, enforced by a check.

- **Scale.** `--space-0-5` (2px), `--space-1` (4px), `--space-1-5` (6px),
  `--space-2` (8px), `--space-3` (12px), `--space-4` (16px), `--space-5` (20px),
  `--space-6` (24px), `--space-8` (32px), `--space-10` (40px), `--space-12` (48px),
  `--space-16` (64px), `--space-20` (80px). The number is the multiple of 4px.
  2px and 6px exist only for tight controls. There is no 10px, 14px or 18px step:
  pick the neighbouring step that reads right.
- **Semantic tokens.** `--page-gap` spaces a page's top-level blocks (24px desktop,
  16px phone) and `--panel-padding` pads `.panel` (24px desktop, 20px phone, 16px
  in phone workspaces). Change the rhythm there, not in each page.
- **Containers own spacing.** Elements carry no outer margins. foundation.css
  resets headings, paragraphs, lists, `dl`/`dd`, `figure`, `blockquote` and `pre`
  to zero margin (as Tailwind's preflight does), and components such as notices,
  load states and pagination have none. The container sets the space between its
  children with `gap`:
  - `main.workspace-page` is a column spaced by `--page-gap`, and its top padding is
    the same `--page-gap`: with no visible page header, the first block sits as far
    below the navigation as the blocks sit from each other. Board pages
    (`main.review-page`) take the same top padding while they load or show a setup,
    so every page's loader sits at the same height; their board workspace sets its
    own tighter padding. Study pages space their blocks by `--page-gap` too.
  - `.panel` is a column with a 16px gap; a panel can set `--panel-gap` for a
    different rhythm, or its own `display` when it lays out differently. A bare
    action inside a panel keeps its natural width. Dialogs keep the browser's
    open/closed display.
  - An open `details` spaces its contents below the summary.
  - The shared `.stack` (column, 16px, `--tight` 8px) and `.cluster` (wrapping
    row, 8px) primitives are available for other common cases; most containers
    still set their own column and gap.

  When a heading and its description sit beside other content, group them in a
  wrapper with its own smaller gap rather than giving either a margin.
- **Exceptions.** `auto` margins for alignment, negative margins that bleed into
  padding, and `margin-inline` on small icons or swatches inside running text.
  A fieldset `legend` sits outside the fieldset's layout, so it pads itself. The
  phone review workspace flattens the board and sidebar with `display: contents`
  to reorder them; gap cannot vary per item there, so review-presentation.css
  spaces those items through the layout's own selectors.
- **Check.** `node scripts/spacing-scale.mjs` (part of `npm run test:styles` and
  `npm run build`) rejects any raw px value above 1px in margin, padding, gap or a
  spacing custom property. `0`, `1px`, `%`, `auto` and em/rem remain allowed.
  Positioning (`top`, `left`, `inset`), sizes and artwork geometry are not spacing
  and are not checked.

## Type

Owner decision, October 12, 2026: text sizes follow one scale, like spacing.
[foundation.css](../frontend/src/foundation.css) defines it.

- **Scale.** `--text-2xs` (10px), `--text-xs` (11px), `--text-sm` (12px),
  `--text-md` (13px), `--text-base` (14px), `--text-lg` (16px), `--text-xl`
  (18px), `--text-2xl` (20px), `--text-3xl` (24px), `--text-4xl` (28px),
  `--text-5xl` (36px), `--text-6xl` (48px). The small steps are dense on purpose:
  the board, notation and mono labels use them.
- **Roles.** Components prefer a role over a raw step, so one change reaches every
  use: `--text-heading-1` (h1), `--text-heading-2` (h2), `--text-heading-3` (h3),
  `--text-body` (paragraphs), `--text-control` (buttons, summaries),
  `--text-caption` (`.small`, labels, code), `--text-label` (mono eyebrows) and
  `--text-input` (fields).
- **Phones.** Roles step down in one place rather than per component: h1 drops to
  28px on phones, workspaces use 18px section headings and 13px body text, and
  fields use 16px so phones do not zoom in on focus.
- **Check.** `node scripts/type-scale.mjs` (part of `npm run test:styles` and
  `npm run build`) rejects px, rem or pt sizes in `font-size` or the `font`
  shorthand. `em`, `%`, container units and keywords stay allowed for sizes that
  follow their container, and `clamp()`/`max()` may combine them with tokens.

## Motion

Owner decision, October 13, 2026: interface motion follows one scale, like spacing
and type. [foundation.css](../frontend/src/foundation.css) defines it.

- **Durations.** `--motion-fast` (150ms) for hover, press and colour feedback,
  `--motion-base` (250ms) for small value changes and things appearing (the
  evaluation bar, the move-rating badge), `--motion-slow` (450ms) for layout that
  opens or closes (import forms), and `--motion-loop` (1200ms) for one cycle of an
  indeterminate loader. Staggered delays are fractions of a token, such as
  `calc(var(--motion-loop) / 4)`.
- **Curves.** `--ease-standard` (ease-in-out) for anything that moves both ways or
  loops, and `--ease-enter` (ease-out) for things arriving.
- **Hover feedback.** Every hover that changes a background, border, colour or fill
  fades over `--motion-fast`. Button, IconButton and ActionLink already do; other
  hoverable rows, cards, tabs, navigation links and graph nodes name the properties they change.
- **Nothing pops in or out.** Content that appears, disappears or is replaced
  after the page is shown animates both ways, identically in every browser
  (owner decisions, October 13, 2026). Wrap a conditional block in `Reveal`,
  keyed rows in `RevealList` (pass `settled` once the data has loaded so the first
  load arrives with its page), and a keyed replacement in `Swap` (`axis="inline"`
  inside a row of controls). Wrap a conditional modal in `DialogPresence` and give
  a native popover `usePopoverExit`. Disclosures animate through
  disclosureMotion; panels, loaders and tab panels fade in through
  [reveal.css](../frontend/src/reveal.css). When a LoadingState or
  UnavailableState is replaced by its content,
  [loadHandoff](../frontend/src/loadHandoff.ts) fades the loader out and then the
  content in, so screens need no wiring of their own. The layout settles at once
  because screens scroll and measure right after they load.
  MotionProvider remembers each account's last motion choice on the device, so the first
  page can animate before the account preference arrives. Do not rely on browser-specific
  features such as `interpolate-size` or `::details-content`.
- **Reduced motion.** [interface-motion.css](../frontend/src/interface-motion.css)
  applies the Still preference and, before preferences load, the device setting to
  every interface element. Components do not write their own reduced-motion
  queries; a component only adds a resting frame for Still when stopping its
  animation would leave it looking wrong (the loading board).
- **Coaches are exempt.** Coach portraits, rigs, idles, reactions and speech keep
  their own hand-tuned timing and their own motion choice; the coach picker and
  studio chrome are interface and follow the scale.
- **Game tempo is not interface motion.** Piece movement (`reviewMotion.ts`),
  lesson autoplay, the Play reply pause and GIF export pacing stay with their
  features.
- **Check.** `node scripts/motion-scale.mjs` (part of `npm run test:styles` and
  `npm run build`) rejects raw times (other than 0) and raw easing keywords or
  functions in `transition` and `animation` properties, `transition: all`, and
  `prefers-reduced-motion` outside the global policy and the loading board.

## Surfaces

Owner decision, October 11, 2026: phones (760px and narrower) show a flattened
interface. Cards still have a job, so they do not all go away, but each one must
earn its surface. Desktop keeps its cards.

1. **Sections are flat on phones.** A page's content blocks (settings sections,
   Home blocks, study and puzzle panels, the catalogue, Insights panels, the Play
   form, lesson pages, import jobs, the games library) drop their background,
   border, rounded corners and inner side padding. A divider and the page gap
   separate neighbouring sections. panel.css does this for every `.panel`; other
   section surfaces flatten in their own phone media query.
2. **A card must earn its surface.** On phones only these stay cards:
   - **Tap targets:** something you tap as one whole thing, such as course cards
     and the resume ("continue") rows.
   - **Status that must stand out:** notices and page banners (including the
     game-in-progress notice) and the coach's speech bubble.
   - **Overlays:** dialogs, popovers and promotion.
3. **No card inside a card.** Nested boxes (provider connections inside Import
   games, chapter rows, study rows, weakness cards) become divided rows.
4. **Controls are not cards.** Buttons, inputs, choice groups, section tabs, badges
   and board chrome keep their own surfaces at every width.

A panel opts into a phone card with `.panel--card`. **Check:** `node
scripts/surfaces.mjs` (part of `npm run test:styles` and `npm run build`) fails
when a file uses `.panel--card` without being listed under `cards` in
[surfaces.json](../frontend/scripts/surfaces.json) with its reason, or when an
application stylesheet draws a card-like surface (a full border with a fill or
rounded corners) that is not listed under `surfaces` with its kind (`control`,
`swatch`, `status`, `overlay`, `board`, `navigation` or `section`). A `section`
surface must also have a rule in the same file that sets `border: 0` for it,
normally in the phone media query. Adding to either list is a design decision:
explain why the surface earns its card. `board` covers only the board and the chrome
attached to it (the board itself and the evaluation bar; player clocks are plain digits that brighten while running); panels below
the board, such as game review's move list and evaluation graph, are `section`s
and flatten on phones like any other page section.

## Colour

Shared colours are tokens in [foundation.css](../frontend/src/foundation.css):
`--text` and `--page-background`; the surfaces `--surface`, `--raised` and
`--line`; `--muted`, `--accent` and `--accent-hover`; the board squares; the
controls (`--control-border`, `--control-hover`, `--control-hover-border`); the
game outcomes (`--outcome-win|draw|loss` and their `-text` shades, shared by game
history and Insights); and the tactical roles (`--pattern-attacker|target|defender`,
shared by the board and the pattern legend). A colour that copies one of these,
or that another sheet must match, uses the token. One-off artwork and component
tints may stay literal. The side swatches (the small white/black squares in game
history, Insights, the game summary and the turn dot) still differ from each
other; choosing one shared swatch is the owner's call.

## Breakpoints

Width tiers are shared, so pages change layout at the same widths:

- **760px: phones.** Every phone rule uses `(max-width: 760px)`, and desktop-only
  rules `(min-width: 761px)`. Script reads the same query through `PHONE_QUERY`
  and `usePhone` ([usePhone.ts](../frontend/src/usePhone.ts)), which share
  [mediaQuery.ts](../frontend/src/mediaQuery.ts)'s one store per query with
  `useReducedMotion`; do not write the query again in a component.
- **1100px, 1000px and 900px: narrow desktops.** Two-column pairs become one
  column below 1100px; the board workspace tightens its gap between 761px and
  1000px; the header rearranges below 900px.
- **1440px: wide screens.** Pages stop at 80% of the window above it.
- **Component tiers.** A shared component may add its own tier for its own
  content when that content needs it (MotionSelect stacks below 600px; a few
  rows tighten below 560px, 540px or 360px). Development tools keep their own
  (the audio studio at 850px, the coach studio at 1050px).

## Owner decision record

The owner's standardization decisions. All 26 approved choices are implemented;
UI-18 and UI-30 keep their existing implementations, and UI-26 and UI-29 are
deferred. A deferred row is not authorization to implement it later.

The main application always takes precedence over development tools when
choosing a shared implementation. Promotion centralizes equivalent UI; it does
not erase differences in navigation semantics, domain behavior or accessibility.

| ID | Decision | Status | Required interpretation |
| --- | --- | --- | --- |
| UI-01 | Promote the Settings section-navigation tray (A). | Complete | `SectionNavigation` serves Settings and Openings; URL history and account/course filtering are preserved. |
| UI-02 | Promote the application's PGN rectangular choice buttons (A). | Complete | `ChoiceGroup` serves PGN source and Studio filters, preserving pressed-button semantics and caller-owned clearing/filtering. |
| UI-03 | One shared button family with ordinary, compact and icon-only sizes, plus primary, secondary and purple return styles. | Complete | Button, IconButton and ActionLink serve ordinary application actions and actual-size Studio coach actions. Purple appearance is consolidated separately in UI-04. ChoiceGroup options, the notation header's commands (dense size) and variation moves are Buttons too, and the foundation `button` element no longer carries a second button style; the notation tabs, the scored move list and playback remain distinct. |
| UI-04 | Promote Game Review's purple return action (A). | Complete | ReturnButton shares the purple style and icon while each mode retains its label, handler, disabled/focus behavior and branch state. |
| UI-05 | Promote lesson/opening playback geometry (C/D). | Complete | Four playback surfaces share controls and fixed counter geometry; game variation/ply-zero behavior, separate flip, responsive toolbar and lesson pending-focus rules remain intact. |
| UI-06 | Promote catalogue pagination labels and layout (B). | Complete | Shared Pagination uses real destination links; 30-game/50-line ranges, filters, history and empty-page recovery remain caller-owned. |
| UI-07 | Share continuation-move markup. | Complete | Puzzles and opening previews share ContinuationMoves with caller-owned numbering, selection and disabled state. Full-game scored notation stays specialized. |
| UI-08 | Share move-feedback announcement rules while retaining rich lesson layout. | Complete | Due, puzzles and lessons use MoveStatus. Puzzles share delayed checking; lesson paragraphs remain rich and navigation never replaces them with Checking. |
| UI-09 | Promote relative next-due time with an exact-time tooltip (A). | Complete | RecallReceipt serves game and opening recalls while their existing domain rules choose saved/relearning/retired/unscheduled copy. |
| UI-10 | Share preference-status rendering with heading and field placements. | Complete | Coach selection and both motion fields use PreferenceStatus; providers, saved flags, retry labels and device fallback remain unchanged. |
| UI-11 | Share compact/panel loading and unavailable states. | Complete | Seven audited consumers share LoadingState/UnavailableState without moving request or recovery logic; pending-to-error transitions preserve navigation focus. |
| UI-12 | Share notice tone/actions with explicit alert, status and passive modes. | Complete | Shared Notice preserves current alerts, passive history and mounted Settings result announcements. Move feedback and preference lifecycle remain distinct. |
| UI-13 | Promote Lessons/Puzzles empty-state styling (C/D) for full sections. | Complete | EmptyState serves seven application consumers; activity/search remain compact and recovery destinations are preserved. |
| UI-14 | Share provider username field rules. | Complete | ProviderUsernameField serves Settings connection, one-time import and onboarding; native validation and description association are centralized. |
| UI-15 | Share the existing PGN/provider analysis option and import action (A/B). | Complete | ImportSubmitButton serves both forms; onboarding says Import games and each form retains its request fields and busy copy. The analysis option was removed when every game became analyzed automatically. |
| UI-16 | Adopt the evidence dialog's modal keyboard/focus behavior for promotion. | Complete | Promotion uses the shared native modal lifecycle, preserving legal choices, drag timing and board-relative placement; page shortcuts yield while a modal is open. |
| UI-17 | Promote plain native-summary styling (A). | Complete | Shared native-summary rules serve connection/import/review/weakness/variation disclosures, preserving 44px targets, rich history contents and cold-practice restrictions. |
| UI-18 | Keep section headings and the distinct action-row layouts separate. | Keep existing | Do not extract a universal component for these different roles. |
| UI-19 | Promote the existing resume-row style and share its markup (A/B/C). | Complete | ResumeLink owns identical lesson, puzzle and course-line rows; native Link behavior and caller destinations/content are preserved. |
| UI-20 | Share the existing puzzle/opening statistics markup in a small StatList. | Complete | Both statistics panels share StatList with their original labels, values, visibility and appearance. |
| UI-21 | Share only the turn indicator used by the board-status compositions. | Complete | Due, lessons and puzzles share the dot; surrounding status and cold-practice visibility stay caller-owned. Opening preview has no existing dot and remains unchanged. |
| UI-22 | Extend the application's AccuracyReadout with a history presentation. | Complete | History shares formatting and completion descriptions; its numeric spans remain passive and queued reviews retain their action state. |
| UI-23 | Share source/link formatting. | Complete | SourceLine serves lessons, puzzle completion and opening previews, preserving optional license/revision and multiple records while validating external protocols. |
| UI-24 | Promote the application's existing MotionSelect into Studio (A). | Complete | Studio uses `MotionSelect` with shared-safe control styles and still clears its simulated reduced-motion setting on selection. |
| UI-25 | Use the application's real EvaluationScore in Studio (B). | Complete | Board-size Studio previews use `EvaluationScore` with typed illustrative scores, correct White perspective, side styling and accessible text. |
| UI-26 | Defer coach-card/selector extraction. | Deferred | Keep current Settings and Studio workflows, shared registry/artwork, and the Settings six-column grid. |
| UI-27 | Share identical artwork/rig wrappers. | Complete | `ArtworkSvg`, `BodyRig` and `HeadRig` serve production family artwork; art, geometry, eyes, animation and species-specific layers remain unchanged. |
| UI-28 | Share application dialogue text/metadata with explicit non-live lab rendering. | Complete | Lab and comparison cards use `DialogueText` with announce=false; definition-list samples retain dd and production retains its polite default. |
| UI-29 | Defer development-tool checkbox-row extraction. | Deferred | Leave current tool implementations in place for this pass. |
| UI-30 | Leave the existing eye implementations alone. | Keep existing | Owner's later "just leave it" supersedes the initial mechanics-only extraction choice. No eye refactor in this pass. |


## Similar-looking components that should stay distinct

- **Route navigation / real tabs / choices:** Settings and Openings are URLs;
  Moves/Move quality is local tab content; PGN input selection is a form choice.
  Share a visual family, not one ambiguous interaction. The main site navigation
  also retains its top-level icon hierarchy and phone layout.
- **Whole players:** Game review, scheduled recall, lesson, puzzle and live play
  sessions already compose Board, ReviewWorkspace and ReviewCoach. Their state,
  answer visibility, progress and grading are intentionally different. The Play
  page ([PlayGame](../frontend/src/play/PlayGame.tsx)) reuses PositionCoach,
  ReviewMoves, EvaluationGraph, PlayerRow and MovePlaybackControls by giving them
  a game-shaped object and its own cursor; it owns no copies of their markup.
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

This document, linked from README and AGENTS, is the durable inventory and
decision record. Use the implemented owners above when changing these interactions.

Application-only primitives and styles are explicitly classified in the CI
planner/style manifest. Shared Button, ChoiceGroup, MotionSelect, score, rig,
modal and dialogue code retain coverage for their development-tool consumers.
Unknown shared files still take the conservative path. Planner regression tests
check that application-only classifications cannot hide shared styles.

