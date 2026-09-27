import { useState } from "react";
import { CoachCharacter } from "../CoachAvatar";
import { expressionInfo, expressions, type CoachExpression } from "../model";
import type { StudioPreview } from "./PreviewPanels";

const groups = [
  { name: "All expressions", states: expressions },
  {
    name: "Good ideas",
    states: [
      "brilliant",
      "great",
      "best",
      "good",
      "book",
      "check",
      "winning",
      "recovered",
    ],
  },
  {
    name: "Hard moments",
    states: [
      "inaccuracy",
      "mistake",
      "blunder",
      "missed",
      "losing",
      "uncertain",
      "encouraging",
    ],
  },
  {
    name: "Between moves",
    states: ["neutral", "idle", "thinking", "explaining", "draw"],
  },
] as const;

export default function ExpressionCollection({
  preview,
  onFamily,
  onSelect,
}: {
  preview: StudioPreview;
  onFamily: (family: string) => void;
  onSelect: (expression: CoachExpression) => void;
}) {
  const [group, setGroup] = useState(0);
  const { coach, family, reaction } = preview;
  return (
    <section className="studio-collection" aria-labelledby="collection-title">
      <div className="studio-section-title">
        <div>
          <p className="eyebrow">THE WHOLE PERSONALITY</p>
          <h2 id="collection-title">
            {coach.families.find((direction) => direction.id === family)?.name}{" "}
            collection
          </h2>
        </div>
        <label>
          Collection
          <select
            value={family}
            onChange={(event) => onFamily(event.target.value)}
          >
            {coach.families.map((direction) => (
              <option value={direction.id} key={direction.id}>
                {direction.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="studio-filters"
        role="group"
        aria-label="Filter expressions"
      >
        {groups.map((item, index) => (
          <button
            key={item.name}
            aria-pressed={group === index}
            onClick={() => setGroup(index)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div className="studio-expression-grid">
        {groups[group].states.map((state) => (
          <button
            key={state}
            className="studio-expression"
            aria-label={`Inspect ${expressionInfo[state].label}`}
            aria-pressed={reaction.state === state}
            onClick={() => {
              onSelect(state);
              document
                .querySelector(".studio-controls")
                ?.scrollIntoView({ behavior: "instant", block: "start" });
            }}
          >
            <CoachCharacter
              coach={coach}
              family={family}
              reaction={{ state, key: `collection:${state}` }}
              motion="still"
              idle={false}
              label={expressionInfo[state].label}
            />
            <span>{expressionInfo[state].label}</span>
            <small>
              {state === "brilliant" || state === "blunder"
                ? "Signature reaction"
                : expressionInfo[state].intent.split(".")[0]}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
