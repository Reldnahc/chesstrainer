import { useCallback, useEffect, useState } from "react";
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
import { ConceptComparison, BoardSizePreview } from "./PreviewPanels";
import ExpressionCollection from "./ExpressionCollection";
import CoachPicker from "./CoachPicker";
import { CastComparison, IdleVariants } from "./PerformanceCollections";
import IdlePlayback from "./IdlePlayback";
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
export default function CoachStudio() {
  const [coachId, setCoachId] = useState(
    () => bookmarkedCoach().collection.id,
  );
  const coach = getCoachStudy(coachId);
  const [expression, setExpression] = useState<CoachExpression>(() => {
    const requested = new URLSearchParams(location.search).get("expression");
    return expressions.find((state) => state === requested) ?? "brilliant";
  });
  const [family, setFamily] = useState(() => bookmarkedCoach().family);
  const selected = selectableCoaches.find(
    (item) => item.collectionId === coach.id && item.defaultFamily === family,
  )!;
  const [motion, setMotion] = useState<CoachMotion>("system");
  const idles = expressionIdles(coach, family, expression);
  const [reduced, setReduced] = useState(false);
  const [replay, setReplay] = useState(0);
  const [reactionReplay, setReactionReplay] = useState(0);
  const [idlePreview, setIdlePreview] = useState<CoachMicro>("");
  const [idleVariant, setIdleVariant] = useState<CoachMicro>("blink");
  const [naturalIdle, setNaturalIdle] = useState(false);
  const [diagnostic, setDiagnostic] = useState(false);
  const [seed, setSeed] = useState("1729");
  const [idleSeed, setIdleSeed] = useState<number>();
  const [idleReset, setIdleReset] = useState(0);
  const [snapshot, setSnapshot] = useState<CoachPerformanceSnapshot | null>(null);
  const observePerformance = useCallback((value: CoachPerformanceSnapshot) => setSnapshot(value), []);
  const chosenIdle = idles.find((idle) => idle === idleVariant) ?? idles[0] ?? "";
  const [playing, setPlaying] = useState(false);
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
    history.replaceState(history.state, "", url);
  }, [expression, family, selected.id]);
  useEffect(() => {
    if (!playing) return;
    let index = 0;
    setExpression(sequence[index]);
    setIdlePreview("");
    const timer = window.setInterval(() => {
      index++;
      if (index >= sequence.length) {
        setPlaying(false);
        return;
      }
      setExpression(sequence[index]);
    }, 2800);
    const stop = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", stop);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", stop);
    };
  }, [playing]);
  function select(state: CoachExpression) {
    setPlaying(false);
    setIdlePreview("");
    setExpression(state);
    setReplay((value) => value + 1);
    setReactionReplay((value) => value + 1);
  }
  function selectCoach(id: string) {
    const nextCoach = getCoach(id);
    const next = getCoachStudy(nextCoach.collectionId);
    setPlaying(false);
    setIdlePreview("");
    setIdleVariant("");
    setCoachId(next.id);
    setFamily(nextCoach.defaultFamily);
    setReplay((value) => value + 1);
    setReactionReplay((value) => value + 1);
    document.querySelector(".studio-controls")?.scrollIntoView({
      block: "start", behavior: "instant",
    });
  }
  function selectFamily(id: string) {
    setPlaying(false);
    setIdlePreview("");
    setIdleVariant("");
    setFamily(id);
    setReplay((value) => value + 1);
    setReactionReplay((value) => value + 1);
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
      <CoachPicker selected={selected.id} onSelect={selectCoach} />
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
        <label>
          Motion intensity
          <select
            value={motion}
            onChange={(event) => {
              setMotion(event.target.value as CoachMotion);
              setReduced(false);
            }}
          >
            <option value="system">Use device setting</option>
            <option value="natural">Animated</option>
            <option value="still">Still</option>
          </select>
        </label>
        <button
          onClick={() => {
            setPlaying(false);
            setIdlePreview("");
            setReplay((value) => value + 1);
            setReactionReplay((value) => value + 1);
            revealPerformance();
          }}
        >
          <RotateCcw size={15} /> Replay reaction
        </button>
        <button
          className={playing ? "primary" : "secondary"}
          onClick={() => setPlaying((value) => !value)}
        >
          <Play size={15} /> {playing ? "Stop sequence" : "Play a sequence"}
        </button>
        <label className="studio-reduced">
          <input
            type="checkbox"
            checked={reduced || deviceStill}
            disabled={deviceStill}
            onChange={(event) => setReduced(event.target.checked)}
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
          setNaturalIdle(value);
          if (value) revealPerformance();
        }}
        diagnostic={diagnostic}
        onDiagnostic={(value) => { setSnapshot(null); setDiagnostic(value); }}
        seed={seed}
        onSeed={setSeed}
        appliedSeed={idleSeed}
        onRestart={() => {
          setIdlePreview("");
          setIdleSeed(Number(seed));
          setIdleReset((value) => value + 1);
          revealPerformance();
        }}
        snapshot={snapshot?.identity === `${coach.id}:${family}` && snapshot.expression === expression ? snapshot : null}
      />
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
          onChange={(event) => setIdleVariant(event.target.value as CoachMicro)}
        >
          {idles.map((idle) => (
            <option key={idle} value={idle}>
              {idlePresentation(coach, family, expression, idle).label}
            </option>
          ))}
        </select>
        <button
          disabled={effectiveMotion === "still"}
          onClick={() => {
            setPlaying(false);
            setIdlePreview(chosenIdle);
            setReplay((value) => value + 1);
            revealPerformance();
          }}
        >
          Preview idle
        </button>
      </section>
      <IdleVariants preview={preview} />
      <BoardSizePreview preview={preview} />
      <CastComparison preview={preview} selected={selected.id} />
      <ExpressionCollection
        preview={preview}
        onFamily={selectFamily}
        onSelect={select}
      />
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
    </div>
  );
}
