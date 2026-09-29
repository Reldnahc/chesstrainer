# Coach idle revamp — implementation plan

Status: proposed for owner review; no animation implementation in this commit.
Branch: `codex/coach-idle-revamp`, created from local `main` at `fa9dc64`.

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
   choices**, replacing the four-element restriction. Cover at least three
   suitable motion groups rather than filling a pool with eight eye variants.
2. Every coach receives **at least four new visibly distinct variants**, including
   **at least two character-directed signature performances**. Aim for roughly
   16–24 available variants per coach across expressions; anatomy and quality
   determine the final repertoire.
3. Reusing motion primitives is encouraged. A variant counts when direction,
   anticipation, movement path, asymmetry, hold, secondary movement or rhythm is
   visibly different at review size. A tiny amplitude change, a different label,
   or reuse in another expression does not count as another animation.
4. Compatible simultaneous motions do not inflate these counts. Basic blinking
   remains independently scheduled and cannot be diluted by a larger choice pool.
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
  selection weight and movement intensity. Compound gestures reserve all their
  parts: scan uses head and gaze; sigh uses body and eyes. These declarations
  also drive studio diagnostics and compatibility tests.
- Allow small compatible motions to overlap, such as a blink during a tail
  settle. Keep one noticeable gesture at a time, with a bounded allowance for
  quiet secondary movement. Do not start every due part simultaneously.
- Preserve the shared **500–1,000 ms visible quiet gap** while resting and
  animated when no visible motion is active. Compatible overlapping gestures
  need no gap between them. Measure quiet time after actual visible motion,
  not after a fixed reserved slot. Part cooldowns prevent constant blinking/wagging without reintroducing
  long whole-character freezes; provide quiet eligible fallback motion.
- Centralize full gesture timings for both scheduler and CSS, including delayed
  child motion. Keep the existing appearance/speed of useful gestures rather
  than stretching a blink to occupy an artificial slot.
- Use weighted recent history and per-part cooldowns to avoid A/B/A/B loops and
  starvation. Inject time/randomness into scheduler tests for reproducibility.
- CSS/SVG perform animation frames. Use bounded, cancellable scheduling rather
  than a continuously running JavaScript frame loop or a timer per SVG element.
- Keep the existing entrance dwell, duration and priority. Cancel/reconcile idles
  when the semantic state or coach changes. Do not remount artwork on every
  micro-gesture or replay an entrance as an idle.

First validate this with Storyteller, Velvet night, Border collie, Frog, Robot
and Slime, covering the main rig and temperament differences before full rollout.

## Milestone 2 — living resting faces

- Separate a reaction's brief facial acting from its held resting face. A happy
  eye squeeze or sympathetic wince may reopen into attentive eyes after the
  entrance while retaining the same smile, brows and emotional meaning.
- Preserve semantic reaction identity and dialogue. A blunder remains concerned;
  a winning finish remains pleased. Do not reset everything to a neutral mood.
- Add suitable eyelid, small brow and gaze behavior. Avoid blinking already-closed
  strokes or moving nonexistent pupils. Expose anatomy/pose capabilities rather
  than relying on coach-name exceptions in the scheduler.
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

## Milestone 4 — studio and live visual iteration

- Replace four-card assumptions with a gallery for the expanded repertoire.
- Offer individual replay and sustained natural-idle preview. Keep actual
  desktop/mobile portrait-size examples and same-state coach comparisons.
- Add developer-only visibility into active parts, next eligibility, cooldowns,
  recent gestures and skipped/conflicting candidates. Provide a reproducible
  playback seed and normal-versus-diagnostic viewing without changing production
  animation preferences or adding a production viewer.
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
  gesture. Coach changes, rapid scrubbing, replay, unmount and offscreen/tab-hidden
  changes cancel correctly. Returning to visibility causes no catch-up burst.
- System follows browser reduced motion; explicit Animated overrides it; Still
  immediately stops all coach motion. Piece/interface motion stays independent.
- All current coaches and expressions meet repertoire/part compatibility targets,
  use live SVG targets and retain readable static states under Still.
- Eye reopening preserves emotion and does not mutate semantic reaction keys,
  dialogue, saved preferences or chess evidence.
- Cold SRS remains neutral before allowed feedback. Animation inputs never use
  hidden answers, grades, Maia hints or unrevealed tactical evidence.
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
