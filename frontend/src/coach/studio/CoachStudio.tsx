import { useEffect, useState } from "react";
import { ArrowLeft, Play, RotateCcw, Sparkles } from "lucide-react";
import Link from "../../Link";
import { getCoach } from "../registry";
import {
  expressionInfo,
  expressions,
  resolveFamily,
  type CoachExpression,
  type CoachMotion,
  type CoachMicro,
} from "../model";
import { useReducedMotion } from "../usePerformance";
import { ConceptComparison, BoardSizePreview } from "./PreviewPanels";
import ExpressionCollection from "./ExpressionCollection";
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
export default function CoachStudio() {
  const coach = getCoach("classic");
  const [expression, setExpression] = useState<CoachExpression>(() => {
    const requested = new URLSearchParams(location.search).get("expression");
    return expressions.find((state) => state === requested) ?? "brilliant";
  });
  const [family, setFamily] = useState(() =>
    resolveFamily(
      coach,
      new URLSearchParams(location.search).get("family") ?? undefined,
    ),
  );
  const [motion, setMotion] = useState<CoachMotion>("natural");
  const [reduced, setReduced] = useState(false);
  const [replay, setReplay] = useState(0);
  const [idlePreview, setIdlePreview] = useState<CoachMicro>("");
  const [idleVariant, setIdleVariant] = useState<CoachMicro>("blink");
  const [playing, setPlaying] = useState(false);
  const deviceReduced = useReducedMotion();
  const effectiveMotion = reduced || deviceReduced ? "still" : motion;
  const reaction = { state: expression, key: `studio:${expression}` };
  const preview = {
    coach,
    family,
    reaction,
    motion: effectiveMotion,
    replay,
    previewIdle: idlePreview,
  };
  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set("expression", expression);
    url.searchParams.set("family", family);
    history.replaceState(history.state, "", url);
  }, [expression, family]);
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
  }
  function revealPerformance() {
    document
      .querySelector(`.studio-${family}`)
      ?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }
  return (
    <div className="coach-studio">
      <Link className="text-button studio-back" href="/settings">
        <ArrowLeft size={15} /> Back to Settings
      </Link>
      <header className="studio-heading">
        <div>
          <p className="eyebrow">FIELDWORK · CHARACTER STUDIES</p>
          <h1>
            A familiar face.
            <br />
            <span>A little more life.</span>
          </h1>
        </div>
        <p>
          Three ways to tell the same story.
          <br />
          Compare the acting, replay a moment, then see how it reads beside the
          board.
        </p>
      </header>
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
            onChange={(event) => setMotion(event.target.value as CoachMotion)}
          >
            <option value="natural">Natural</option>
            <option value="subtle">Subtle</option>
            <option value="still">Still</option>
          </select>
        </label>
        <button
          onClick={() => {
            setPlaying(false);
            setIdlePreview("");
            setReplay((value) => value + 1);
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
            checked={reduced || deviceReduced}
            disabled={deviceReduced}
            onChange={(event) => setReduced(event.target.checked)}
          />{" "}
          Reduced motion
        </label>
      </section>
      {(reduced || deviceReduced) && (
        <p className="studio-motion-notice" role="status">
          {deviceReduced
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
        <p>{expressionInfo[expression].intent}</p>
      </div>
      <ConceptComparison preview={preview} onFamily={setFamily} />
      <section className="studio-idle-bar" aria-label="Idle previews">
        <div>
          <h2>The quieter moments</h2>
          <p>
            One reaction, then room to breathe. Idle gestures vary, with long
            pauses between them.
          </p>
        </div>
        <label className="sr-only" htmlFor="idle-variant">
          Idle gesture
        </label>
        <select
          id="idle-variant"
          value={idleVariant}
          onChange={(event) => setIdleVariant(event.target.value as CoachMicro)}
        >
          <option value="blink">Blink</option>
          <option value="glance">Look around</option>
          <option value="breathe">Breathe</option>
          <option value="nod">Small nod</option>
          <option value="glasses">Settle glasses</option>
          <option value="sigh">Exhale</option>
          <option value="twinkle">Delighted glint</option>
        </select>
        <button
          disabled={effectiveMotion === "still"}
          onClick={() => {
            setPlaying(false);
            setIdlePreview(idleVariant);
            setReplay((value) => value + 1);
            revealPerformance();
          }}
        >
          Preview idle
        </button>
      </section>
      <BoardSizePreview preview={preview} />
      <ExpressionCollection
        preview={preview}
        onFamily={setFamily}
        onSelect={select}
      />
      <aside className="studio-note">
        <Sparkles size={20} />
        <p>
          <strong>One character, three directions.</strong> These studies share
          the original coach's hair, glasses, beard and jacket. Storyteller is
          used in your reviews; the other directions stay here for comparison.
          Preview controls never change your account preferences.
        </p>
      </aside>
    </div>
  );
}
