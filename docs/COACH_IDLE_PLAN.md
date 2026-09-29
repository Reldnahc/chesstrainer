# Coach idle revamp — implementation plan

Status: implementation in progress; Milestone 1 is complete. Next: resting faces.
The plan passed three design-review rounds before implementation.
Branch: `codex/coach-idle-revamp`, created from local `main` at `fa9dc64`.

Owner addition: give generically labeled coaches personalized display names while
preserving existing distinctive titles and stable account IDs. Completed in
`fee508e`; naming/picker/bookmark coverage passed on desktop and mobile.

Milestone 1: implemented the channel coordinator, canonical timings, independent
blinking, rig capabilities, memoized artwork and variable-size studio gallery.
84 focused desktop/mobile checks, production build, API/type agreement and diff
checks passed. Independent review's unsupported-preview issue was fixed. Details
and the Windows test-server workaround are recorded in `VERIFICATION.md`.

## Intended experience

Coaches should stay visibly alive while the learner studies, with natural eye
movement, posture and character-specific gestures. They should retain their
personality and the emotion of the current feedback without repeatedly performing
the entrance reaction. Increase the repertoire as well as improving scheduling.

This builds on the existing SVG rigs, shared coach component, semantic reaction
mapping and account motion preference. The live development studio is required
for visual acceptance; compilation and animation-name assertions are insufficient.

## Audit baseline

- The current registry has 30 selectable coaches and 20 expressions. Each
  coach/expression selects exactly four entries from 16 shared gesture types.
  The 2,400 configured slots are combinations, not 2,400 unique animations.
- An in-memory rendered-artwork check found targets for every configured slot.
- One `data-micro` serializes all idle motion. Eyes, body and appendages compete
  for that one slot even though their SVG groups are already separate.
- Every gesture reserves 1,200 ms. A normal blink ends after 260 ms, leaving
  940 ms of invisible reserved time before the shared 500–1,000 ms pause.
- Selection only prevents repeating the immediately previous gesture. Alternating
  two gestures can continue indefinitely, and some neutral pools never blink.
- Shared Good, Mistake, Winning and Recovered faces hold closed-eye artwork.
  Their blink animations compress a closed line rather than opening the eyes.
- Several existing parts have little or no idle role: wings, mane, antenna,
  cap, ears and hands/paws. Some generic keyframes always move in one direction.

## Coverage targets

1. Every current coach/expression has **at least eight authored, compatible idle
   choices** for its steady resting pose, replacing the four-element restriction.
   Count anatomy/emotion-compatible variants before temporary cooldown, conflict
   or visibility filtering. Each repertoire spans at least three suitable motion
   groups, rather than eight eye variants. Basic blinking can count once when
   supported, but its scheduling remains independent of the optional choice pool.
2. Every coach receives **at least four new visibly distinct variants**, including
   **at least two character-directed signature performances**. Aim for roughly
   16–24 available variants per coach across expressions; anatomy and quality
   determine the final repertoire.
3. Reusing motion primitives is encouraged. A variant counts when direction,
   anticipation, movement path, asymmetry, hold, secondary movement or rhythm is
   visibly different at review size. A tiny amplitude change, a different label,
   or reuse in another expression does not count as another animation.
4. Arbitrary simultaneous combinations do not inflate these counts. An explicitly
   authored compound performance can count when its coordinated timing is visibly
   distinct. Count a variant reused across expressions only once toward a coach's
   four new additions; compare against the recorded baseline catalogue. The two
   signatures are required per coach, not per expression, and must be reachable
   during normal idle playback in suitable states, not only through studio replay.
5. Enumerate the live registry for coverage and validation; do not encode 30 as a
   permanent production limitation. The targets apply to every current coach.

## Milestone 1 — coordinated motion and correct timing

Replace the single idle slot with one small coordinator managing independently
eligible motion groups:

| Group | Examples | Coordination |
|---|---|---|
| Eyes | Blink, measured blink, double blink | Bounded time between blinks when appropriate; no dependence on winning a random draw |
| Attention | Glance, head tilt, look down, scan | Vary direction and focus; coordinate gaze with head motion |
| Body | Breath, lean, shoulder/posture settle, exhale | Maintain life between more noticeable gestures |
| Character details | Ears, tail, hair, glasses, wings, antenna, cap | Anatomy-aware selection and character-specific emphasis |

- A gesture declares its parts, complete duration, eligibility, cooldown,
  selection weight and movement intensity. The groups above organize behavior;
  conflicts are determined by actual animated rig channels, including the SVG
  wrapper/property being written. Competing writes to one transform are exclusive;
  nested head, eyelid and gaze tracks may compose when explicitly compatible.
  Compound reservations are atomic: scan uses head and gaze; sigh uses body and
  eyes. These declarations also drive studio diagnostics and compatibility tests.
- Allow small compatible motions to overlap, such as a blink during a tail
  settle. Keep one noticeable gesture at a time, with a bounded allowance for
  quiet secondary movement. Do not start every due part simultaneously.
- Preserve the shared **500–1,000 ms quiet gap** during uninterrupted, visible,
  animated rest with automatic idles enabled. The gap starts when the last
  authored gesture finishes; compatible overlapping gestures need no gap between
  them. Use the true authored duration, not a fixed reserved slot or per-frame
  motion detection. Reaction dwell/entrance, pauses and explicit studio replay
  are outside this cadence contract.
- Scheduling priority is pause/reaction first, then anatomy and channel safety,
  then due baseline eye activity, then optional weighted gestures. A due blink
  never interrupts an incompatible track or bypasses the minimum quiet gap.
  Measure blink opportunities in active resting time; suspension does not accrue
  debt. Bound deferral by the active incompatible gesture's remaining duration
  plus the maximum quiet gap, and prevent optional gestures from extending that
  deferral indefinitely. Poses without blink-capable eyes suspend this obligation.
- Use one baseline-eye clock: a completed visible eye closure/reopen, including
  one within a signature or sigh, satisfies it. Gaze motion alone does not.
  Validate that eye cooldowns allow the next blink within the declared bound;
  optional eye gestures cannot keep postponing that opportunity. Do not schedule
  an unnecessary second blink immediately after a compound gesture's blink.
- Cooldowns still apply to quiet fallback motion. Validate that each eligible
  resting repertoire can supply a legal quiet action by the maximum gap; a
  fallback must not secretly bypass exhausted cooldowns. Reject infeasible
  catalogue configurations in tests and expose them in studio diagnostics.
  Runtime safety wins over cadence if an invalid configuration reaches the UI.
- Centralize full gesture timings for both scheduler and CSS, including delayed
  child motion and intentional holds. Keep the existing appearance/speed of useful
  gestures rather than stretching a blink to occupy an artificial slot.
- Use weighted recent history and per-part cooldowns to avoid A/B/A/B loops and
  starvation. Inject time/randomness into scheduler tests for reproducibility.
- CSS/SVG perform animation frames. Use bounded, cancellable scheduling rather
  than a continuously running JavaScript frame loop or a timer per SVG element.
- Keep the existing entrance dwell, duration and priority. A reaction key change
  cancels stale tracks even when the expression is unchanged (two Best moves).
  Known feedback stays readable immediately; only its entrance waits for the
  dwell. Do not remount artwork on every micro-gesture or replay an entrance as
  an idle.
- Hidden/offscreen/Still states abort active tracks and retain only the latest
  reaction. Resume with fresh idle deadlines, no catch-up burst and no replay of
  an already-started entrance. A newer pending reaction still follows the existing
  dwell/entrance policy. Preserve same-coach recent history across pauses; reset
  deadlines without accruing hidden time. Coach/family changes discard prior rig
  history and cooldowns. Ordinary rerenders do not reset either.
- Keep automatic-idle disabling and reaction disabling independent. Unselected
  Settings portraits remain static. A requested developer replay may run one
  gesture with automatic idles disabled; it still honors effective motion and
  visibility settings and must not silently start an idle loop.

First validate this with Storyteller, Velvet night, Border collie, Frog, Robot
and Slime, covering the main rig and temperament differences before full rollout.
Bring the minimal pose-capability declarations and working studio replay/expanded
gallery support into this milestone so the prototype is inspectable immediately.
Update affected contract tests and four-entry assertions with that model change.
Validate initial scheduling on blink-capable resting poses; Milestone 2 completes
resting-face compatibility across expressions, and Milestone 4 polishes diagnostics.

## Milestone 2 — living resting faces

- Separate a reaction's brief facial acting from its held resting face. A happy
  eye squeeze or sympathetic wince may reopen into attentive eyes after the
  entrance while retaining the same smile, brows and emotional meaning.
- Preserve semantic reaction identity and dialogue. A blunder remains concerned;
  a winning finish remains pleased. Do not reset everything to a neutral mood.
- Add suitable eyelid, small brow and gaze behavior. Avoid blinking already-closed
  strokes or moving nonexistent pupils. Expose anatomy/pose capabilities rather
  than relying on coach-name exceptions in the scheduler.
- Still (including System with reduced motion) renders the chosen expressive
  static resting face immediately, without a delayed eye-opening animation.
  Animated entrance-to-rest changes remain within the existing reaction duration.
  Do not briefly reopen eyes during the dwell only to close them for the entrance;
  cancel pending face transitions on reaction-key changes, pause or unmount.
  An interrupted entrance settles to its steady expressive face on resume
  (immediately for Still); canceled reopening must not leave a closed entrance
  face stuck in rest. A newer reaction takes precedence over that settling.
- Layer transforms so idle head/body motion composes with the held pose. Retain
  expression-specific pivots, eye masks, fixed portrait bounds and layout stability.

## Milestone 3 — expanded repertoire across the whole cast

Expand shared primitives with directional glances, short scans, double blinks,
different nod rhythms, asymmetric tilts, lean/settle variations, shoulder shifts,
small brow reactions and restrained hand/paw adjustments. Add appropriate
appendage variants: single-ear listening, paired ear settling, tail-tip movement,
tail tuck/relax, hair/mane settling, wing folding and mechanical lens/antenna motion.

Use these proposed signature pairs as starting art direction, then refine in the
live preview. Existing silhouettes, clothing, species and personality remain.

| Coach | Proposed signature additions |
|---|---|
| Storyteller | Glasses adjustment with a supporting hand; warm two-stage nod and shoulder settle |
| Club host | Open-hand conversational reset; friendly lean-back and renewed attention |
| Endgame expert | Deliberate gaze shift followed by a small nod; precise posture correction |
| Creative partner | Asymmetric curious tilt with following gaze; small open-hand consideration |
| Club captain | Squared-shoulder reset; decisive nod that settles into attention |
| Quiet analyst | Measured glasses/eye refocus; restrained chin dip and thoughtful brow |
| Bright spark | Hair-following double take; eager lean with a quick brow lift |
| Golden braid | Braid settling after a gentle turn; reassuring hand and shoulder release |
| Young Boy | Eager lean with delayed hair movement; small hand reposition and quick look back |
| Young Girl | Alternating investigative tilt; discovery-like brow lift and hair settle |
| Gentle professor | One soft ear responding before the other; slow muzzle lift with tail-tip settle |
| Pocket captain | Compact chest/posture reset; asymmetric alert ear flick |
| Border collie | Focused scan with ears following in sequence; brief paw shift and attentive return |
| Puppy | Uneven curious ear lift; eager small paw shuffle with restrained tail movement |
| Midnight tactician | Slow directional glance and delayed tail-tip punctuation; one-ear skeptical listen |
| Velvet night | Soft blink followed by a subtle ear turn; small paw tuck and quiet tail curl |
| Kitten | Quick left/right investigation; playful paw reposition with uneven ears |
| Gorilla | Grounded shoulder release; deliberate hand and gaze adjustment |
| Raccoon | Nimble paw adjustment; searching glance followed by independent ear response |
| Frog | Throat breath with delayed eyelid movement; tiny asymmetric head/eye refocus |
| Capybara | Unhurried ear settle; relaxed weight shift and soft eye reopen |
| Unicorn | Mane settling after a graceful turn; independent ear listen with muzzle lift |
| Wizard | Glasses/hand consideration; restrained beard or sleeve follow-through |
| Dragon | Small wing fold and release; deliberate ear/horn-line turn with focused gaze |
| Ghost | Gentle vertical settle with trailing lower silhouette; slow curious side drift and gaze return |
| Alien | Asymmetric eye/brow refocus; inquisitive head turn with delayed gaze |
| Robot | Lens refocus with antenna settle; precise two-step scan and mechanical posture correction |
| Slime | Soft weight transfer with delayed facial settle; small squash/rebound of different rhythm |
| Mushroom | Cap settling independently from the body; curious stem lean and delayed cap response |
| Living Pawn | Base weight shift; purposeful chest/head lift and a restrained return |

Signatures may share mechanics but must read differently through rhythm, anatomy
and pose. Add only small necessary rig layers for new parts. Emotion eligibility
matters: worried tail settling is distinct from happy wagging; avoid celebratory
motion during mistakes, blunders or loss. Do not repeat surprise or distress
entrances continuously.

Hand/paw movement must retain joint attachment and held-prop contact. A hand may
not detach from its sleeve or a shoulder from the torso; book-holding poses must
exclude incompatible gestures or coordinate the supporting limb and prop.

## Milestone 4 — studio and live visual iteration

- Finish the expanded gallery introduced in Milestone 1; remove remaining
  four-card copy and layout assumptions.
- Offer individual replay and sustained natural-idle preview. Keep actual
  desktop/mobile portrait-size examples and same-state coach comparisons.
- Add developer-only visibility into active parts, next eligibility, cooldowns,
  recent gestures and skipped/conflicting candidates. Provide a reproducible
  playback seed and normal-versus-diagnostic viewing without changing production
  animation preferences or adding a production viewer.
- Keep sustained playback opt-in per preview/comparison. Individual gallery cards
  use bounded replay rather than all running continuously; offscreen cards pause.
  Use the same scheduler as production, including in seeded diagnostic playback.
- Observe each representative coach for 60–90 seconds at normal size to detect
  long pauses, distracting motion, repetition, awkward settling and barely
  visible movements. Inspect every coach's new signatures and every expression
  for eye/pose compatibility, plus all current coaches at desktop/mobile sizes.
- Revisit any weaker characters after the full rollout. Motion that exists only
  technically, but cannot be read at actual review size, does not pass.

## Milestone 5 — integration, regression coverage and completion

The shared character component continues to serve game review, SRS, explanations,
Settings and the development studio. No separate animation implementation per page.

Automated checks must cover:

- Real gesture durations, bounded visible quiet gaps, independent eligibility,
  mandatory eye opportunities, cooldowns, anti-repeat history and conflict rules.
- Compound actions and interruption; no stale finish callback clears a newer
  gesture. Coach/family changes, rapid same-expression navigation, replay, unmount
  and offscreen/tab-hidden changes cancel correctly. Returning to visibility causes
  no catch-up burst. Rerenders preserve history; motion/visibility resumes respect
  the defined reset boundaries. Disabled automatic idles never restart themselves.
- System follows browser reduced motion; explicit Animated overrides it; Still
  immediately stops all coach motion. Piece/interface motion stays independent.
- All current coaches and expressions meet repertoire/part compatibility targets,
  use live SVG targets and retain readable static states under Still.
- Eye reopening preserves emotion and does not mutate semantic reaction keys,
  dialogue, saved preferences or chess evidence.
- Preserve cold SRS's existing public lifecycle feedback (readiness, busy/error
  states and feedback from permitted attempts). Before an attempt/reveal, animation
  inputs never use hidden answers, move grades, Maia hints or unrevealed tactical
  evidence. Idle eligibility depends on public expression and rig capabilities.
- No reaction replay during idles, no idle-driven SVG remount, no layout shift,
  and no unbounded timer/observer growth with large studio grids.

Run focused scheduler, coach, studio and affected application tests per milestone;
then run the normal relevant frontend type/build/browser verification and backend
contract/cold-SRS checks for final completion. Check the real game-review and SRS
screens as well as the studio. Report skips or environmental failures accurately.

Update `COACH.md`, relevant cast motion notes and `VERIFICATION.md`. Commit each
coherent verified milestone; no pushing, merging or deployment is included unless
the owner requests it. Once complete, move any durable design decisions from this
plan into living documentation and remove this temporary implementation plan.

## Scope boundaries

No new coaches, art-style replacement, chess grading changes, personality/dialogue
rewrite, voice/TTS, account/schema changes, or additional end-user motion settings.
Existing reaction timings and motion-preference behavior remain unless a concrete
correctness issue is found and documented. Similar new gestures are welcome when
their differences are visible and serve the individual character.
