import { useCallback, useEffect, useReducer } from "react";
import { Play, RotateCcw, Sparkles } from "lucide-react";
import { getCoachStudy } from "../studies/catalog";
import {
  getCoach, retiredCoachReplacements, selectableCoaches,
} from "../registry";
import {
  expressionInfo,
  expressionIntent,
  expressionIdles,
  availableIdles,
  idlePresentation,
  expressions,
  resolveFamily,
  type CoachExpression,
  type CoachMotion,
  type CoachMicro,
} from "../model";
import { useReducedMotion } from "../../useReducedMotion";
import MotionSelect from "../../MotionSelect";
import ChoiceGroup from "../../ChoiceGroup";
import Button from "../../Button";
import { ConceptComparison, BoardSizePreview } from "./PreviewPanels";
import ExpressionCollection from "./ExpressionCollection";
import CoachPicker from "./CoachPicker";
import { CastComparison, IdleVariants } from "./PerformanceCollections";
import IdlePlayback from "./IdlePlayback";
import SpeechInspector from "./SpeechInspector";
import type { CoachPerformanceSnapshot } from "../performanceDiagnostics";
import "./studio.css";

const sequence: CoachExpression[] = [
  "neutral",
  "thinking",
  "brilliant",
  "best",
  "blunder",
  "encouraging",
  "recovered",
  "winning",
];
function bookmarkedCoach() {
  const query = new URLSearchParams(location.search);
  const requested = query.get("coach");
  const legacy: Record<string, string> = {
    "cat:tabby": "cat-tabby",
    "cat:calico": "cat-calico",
    "dog:sunny": "dog-sunny",
    "retriever:sunny": "dog-sunny",
  };
  const retired = legacy[`${requested}:${query.get("family")}`] ?? requested;
  const replacement = retired && Object.hasOwn(retiredCoachReplacements, retired)
    ? getCoach(retired) : undefined;
  const production = replacement ?? selectableCoaches.find(
    (coach) => coach.id === requested,
  );
  const collection = getCoachStudy(production?.collectionId ?? requested);
  return {
    collection,
    family: resolveFamily(
      collection,
      replacement?.defaultFamily ?? query.get("family") ?? production?.defaultFamily,
    ),
  };
}
type StudioState = {
  view: "acting" | "speech";
  coachId: string;
  family: string;
  expression: CoachExpression;
  motion: CoachMotion;
  reduced: boolean;
  replay: number;
  reactionReplay: number;
  idlePreview: CoachMicro;
  idleVariant: CoachMicro;
  naturalIdle: boolean;
  diagnostic: boolean;
  seed: string;
  idleSeed: number | undefined;
  idleReset: number;
  snapshot: CoachPerformanceSnapshot | null;
  playing: boolean;
};

type StudioAction =
  | { type: "view"; view: StudioState["view"] }
  | { type: "expression"; expression: CoachExpression }
  | { type: "coach"; coachId: string; family: string }
  | { type: "family"; family: string }
  | { type: "replay reaction" }
  | { type: "toggle sequence" }
  | { type: "stop sequence" }
  | { type: "sequence step"; expression: CoachExpression; first: boolean }
  | { type: "motion"; motion: CoachMotion }
  | { type: "reduced"; reduced: boolean }
  | { type: "idle variant"; idle: CoachMicro }
  | { type: "preview idle"; idle: CoachMicro }
  | { type: "natural idle"; natural: boolean }
  | { type: "diagnostic"; diagnostic: boolean }
  | { type: "seed"; seed: string }
  | { type: "restart idle" }
  | { type: "snapshot"; snapshot: CoachPerformanceSnapshot };

/** Every control that starts something new stops the sequence and any idle preview. */
const interrupted = (state: StudioState): StudioState => ({ ...state, playing: false, idlePreview: "" });
/** A new reaction replays both the stage and the reaction itself. */
const replayed = (state: StudioState): StudioState =>
  ({ ...state, replay: state.replay + 1, reactionReplay: state.reactionReplay + 1 });

function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "view": return { ...interrupted(state), view: action.view };
    case "expression": return replayed({ ...interrupted(state), expression: action.expression });
    case "coach": return replayed({ ...interrupted(state), idleVariant: "", coachId: action.coachId, family: action.family });
    case "family": return replayed({ ...interrupted(state), idleVariant: "", family: action.family });
    case "replay reaction": return replayed(interrupted(state));
    case "toggle sequence": return { ...state, playing: !state.playing };
    case "stop sequence": return { ...state, playing: false };
    case "sequence step": return { ...state, ...(action.first ? { idlePreview: "" } : {}), expression: action.expression };
    case "motion": return { ...state, motion: action.motion, reduced: false };
    case "reduced": return { ...state, reduced: action.reduced };
    case "idle variant": return { ...state, idleVariant: action.idle };
    case "preview idle": return { ...interrupted(state), idlePreview: action.idle, replay: state.replay + 1 };
    case "natural idle": return { ...state, naturalIdle: action.natural };
    case "diagnostic": return { ...state, snapshot: null, diagnostic: action.diagnostic };
    case "seed": return { ...state, seed: action.seed };
    case "restart idle": return { ...state, idlePreview: "", idleSeed: Number(state.seed), idleReset: state.idleReset + 1 };
    case "snapshot": return { ...state, snapshot: action.snapshot };
  }
}

function initialStudio(): StudioState {
  const query = new URLSearchParams(location.search);
  const bookmark = bookmarkedCoach();
  return {
    view: query.get("view") === "speech" ? "speech" : "acting",
    coachId: bookmark.collection.id,
    family: bookmark.family,
    expression: expressions.find((state) => state === query.get("expression")) ?? "brilliant",
    motion: "system",
    reduced: false,
    replay: 0,
    reactionReplay: 0,
    idlePreview: "",
    idleVariant: "blink",
    naturalIdle: false,
    diagnostic: false,
    seed: "1729",
    idleSeed: undefined,
    idleReset: 0,
    snapshot: null,
    playing: false,
  };
}

export default function CoachStudio() {
  const [state, dispatch] = useReducer(studioReducer, undefined, initialStudio);
  const {
    view, coachId, family, expression, motion, reduced, replay, reactionReplay, idlePreview,
    idleVariant, naturalIdle, diagnostic, seed, idleSeed, idleReset, snapshot, playing,
  } = state;
  const coach = getCoachStudy(coachId);
  const selected = selectableCoaches.find(
    (item) => item.collectionId === coach.id && item.defaultFamily === family,
  )!;
  const idles = expressionIdles(coach, family, expression);
  const observePerformance = useCallback((value: CoachPerformanceSnapshot) => dispatch({ type: "snapshot", snapshot: value }), []);
  const chosenIdle = idles.find((idle) => idle === idleVariant) ?? idles[0] ?? "";
  const deviceReduced = useReducedMotion();
  const deviceStill = motion === "system" && deviceReduced;
  const effectiveMotion = reduced || deviceStill ? "still" : motion;
  const reaction = {
    state: expression,
    key: `studio:${coach.id}:${expression}`,
  };
  const preview = {
    coach,
    family,
    reaction,
    motion: effectiveMotion,
    replay,
    reactionReplay,
    previewIdle: idlePreview,
    idle: naturalIdle,
    idleSeed,
    idleReset,
  };
  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set("coach", selected.id);
    url.searchParams.set("expression", expression);
    url.searchParams.set("family", family);
    if (view === "speech") url.searchParams.set("view", view);
    else url.searchParams.delete("view");
    history.replaceState(history.state, "", url);
  }, [expression, family, selected.id, view]);
  useEffect(() => {
    if (!playing) return;
    let index = 0;
    dispatch({ type: "sequence step", expression: sequence[index], first: true });
    const timer = window.setInterval(() => {
      index++;
      if (index >= sequence.length) {
        dispatch({ type: "stop sequence" });
        return;
      }
      dispatch({ type: "sequence step", expression: sequence[index], first: false });
    }, 2800);
    const stop = () => {
      if (document.hidden) dispatch({ type: "stop sequence" });
    };
    document.addEventListener("visibilitychange", stop);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", stop);
    };
  }, [playing]);
  function select(next: CoachExpression) {
    dispatch({ type: "expression", expression: next });
  }
  function selectCoach(id: string) {
    const nextCoach = getCoach(id);
    dispatch({ type: "coach", coachId: getCoachStudy(nextCoach.collectionId).id, family: nextCoach.defaultFamily });
    document.querySelector(".studio-controls")?.scrollIntoView({
      block: "start", behavior: "instant",
    });
  }
  function selectFamily(id: string) {
    dispatch({ type: "family", family: id });
  }
  function revealPerformance() {
    document
      .querySelector(`.studio-${family}`)
      ?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }
  return (
    <div className="coach-studio">
      <p className="studio-dev-notice">
        Development studio · No account or engine connection
      </p>
      <div className="studio-main">
        <header className="studio-heading">
          <div>
            <p className="eyebrow">FIELDWORK · CHARACTER STUDIES</p>
            <h1>
              Meet your next coach.
              <br />
              <span>A little more personality.</span>
            </h1>
          </div>
          <p>
            {selectableCoaches.length} coaches to explore, with {expressions.length}{" "}
            expressions and character-specific idle performances.
            <br />
            Compare the acting, replay a moment, then see how it reads beside the
            board.
          </p>
        </header>
        <div className="studio-workbench" data-view={view}>
          <div className="studio-setup">
            <CoachPicker selected={selected.id} onSelect={selectCoach} />
            <div className="studio-toolbar">
              <ChoiceGroup label="Studio view" value={view} onChange={(value) => dispatch({ type: "view", view: value })} options={[{ value: "acting", label: "Acting" }, { value: "speech", label: "Mouth shapes" }]} />
              <div>
                <section
                  className="studio-controls"
                  aria-label="Animation preview controls"
                >
                  <label>
                    Expression
                    <select
                      value={expression}
                      onChange={(event) => select(event.target.value as CoachExpression)}
                    >
                      {expressions.map((state) => (
                        <option value={state} key={state}>
                          {expressionInfo[state].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <MotionSelect id="studio-motion" label="Motion intensity" layout="stacked"
                    value={motion} onChange={value => dispatch({ type: "motion", motion: value })} />
                  {view === "acting" && <>
                  <Button
                    onClick={() => {
                      dispatch({ type: "replay reaction" });
                      revealPerformance();
                    }}
                  >
                    <RotateCcw size={15} /> Replay reaction
                  </Button>
                  <Button
                    variant={playing ? "primary" : "secondary"}
                    onClick={() => dispatch({ type: "toggle sequence" })}
                  >
                    <Play size={15} /> {playing ? "Stop sequence" : "Play a sequence"}
                  </Button>
                  </>}
                  <label className="studio-reduced">
                    <input
                      type="checkbox"
                      checked={reduced || deviceStill}
                      disabled={deviceStill}
                      onChange={(event) => dispatch({ type: "reduced", reduced: event.target.checked })}
                    />{" "}
                    Reduced motion
                  </label>
                </section>
                {(reduced || deviceStill) && (
                  <p className="studio-motion-notice" role="status">
                    {deviceStill
                      ? "Your device requests reduced motion."
                      : "Reduced-motion preview is on."}{" "}
                    Expressions stay visible; motion is paused.
                  </p>
                )}
              </div>
            </div>
          </div>
          {view === "speech" ? (
            <SpeechInspector coach={selected} expression={expression} />
          ) : (
            <div className="studio-stage">
              <div className="studio-stage-main">
                <div className="studio-moment">
                  <div>
                    <span className="studio-counter">
                      {String(expressions.indexOf(expression) + 1).padStart(2, "0")} /{" "}
                      {expressions.length}
                    </span>
                    <h2>{expressionInfo[expression].label}</h2>
                  </div>
                  <p>{expressionIntent(coach, expression)}</p>
                </div>
                <ConceptComparison preview={preview} onFamily={selectFamily}
                  onPerformance={diagnostic ? observePerformance : undefined} />
                <IdlePlayback
                  natural={naturalIdle}
                  onNatural={(value) => {
                    dispatch({ type: "natural idle", natural: value });
                    if (value) revealPerformance();
                  }}
                  diagnostic={diagnostic}
                  onDiagnostic={(value) => dispatch({ type: "diagnostic", diagnostic: value })}
                  seed={seed}
                  onSeed={(value) => dispatch({ type: "seed", seed: value })}
                  appliedSeed={idleSeed}
                  onRestart={() => {
                    dispatch({ type: "restart idle" });
                    revealPerformance();
                  }}
                  snapshot={snapshot?.identity === `${coach.id}:${family}` && snapshot.expression === expression ? snapshot : null}
                />
              </div>
              <div className="studio-idles">
                <section className="studio-idle-bar" aria-label="Idle previews">
                  <div>
                    <h2>The quieter moments</h2>
                    <p>
                      {idles.length} gestures for {selected.name} · {expressionInfo[expression].label}.
                      Idle previews never replay the reaction.
                    </p>
                  </div>
                  <label className="sr-only" htmlFor="idle-variant">
                    Idle gesture
                  </label>
                  <select
                    id="idle-variant"
                    value={chosenIdle}
                    onChange={(event) => dispatch({ type: "idle variant", idle: event.target.value as CoachMicro })}
                  >
                    {idles.map((idle) => (
                      <option key={idle} value={idle}>
                        {idlePresentation(coach, family, expression, idle).label}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={effectiveMotion === "still"}
                    onClick={() => {
                      dispatch({ type: "preview idle", idle: chosenIdle });
                      revealPerformance();
                    }}
                  >
                    Preview idle
                  </Button>
                </section>
                <IdleVariants preview={preview} />
              </div>
            </div>
          )}
        </div>
        {view === "acting" && <>
          <BoardSizePreview preview={preview} />
          <CastComparison preview={preview} selected={selected.id} />
          <ExpressionCollection
            preview={preview}
            onFamily={selectFamily}
            onSelect={select}
          />
        </>}
      </div>
      {view === "acting" && (
        <aside className="studio-note">
          <Sparkles size={20} />
          <p>
            <strong>
              {selected.name}: {selected.expressions.length} expressions,{" "}
              {availableIdles(coach, family).length} idle performances.
            </strong>{" "}
            {selected.description} All of these coaches are available in Settings for
            game review and practice. Preview controls never change your account
            preferences.
          </p>
        </aside>
      )}
    </div>
  );
}
