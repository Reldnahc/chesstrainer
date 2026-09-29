import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { CoachCharacter } from "../CoachAvatar";
import { getCoach, selectableCoaches } from "../registry";
import {
  expressionIdles,
  expressionInfo,
  idlePresentation,
  type CoachIdle,
} from "../model";
import type { StudioPreview } from "./PreviewPanels";

function IdleCard({ preview, gesture, index }: {
  preview: StudioPreview;
  gesture: CoachIdle;
  index: number;
}) {
  const [replay, setReplay] = useState(0);
  const { label, description } = idlePresentation(preview.coach, preview.family, preview.reaction.state, gesture);
  return (
    <article className="studio-idle-card" data-gesture={gesture}>
      <span className="studio-size-label">
        IDLE {String(index + 1).padStart(2, "0")}
      </span>
      <CoachCharacter
        coach={preview.coach}
        family={preview.family}
        reaction={preview.reaction}
        motion={preview.motion}
        previewIdle={gesture}
        replay={replay}
        idle={false}
        label={`${expressionInfo[preview.reaction.state].label}: ${label}`}
      />
      <h3 title={description}>{label}</h3>
      <button
        aria-label={`Replay idle ${index + 1}: ${label}`}
        disabled={preview.motion === "still"}
        onClick={() => setReplay((value) => value + 1)}
      >
        <RotateCcw size={14} /> Replay idle
      </button>
    </article>
  );
}

export function IdleVariants({ preview }: { preview: StudioPreview }) {
  const pool = expressionIdles(
    preview.coach, preview.family, preview.reaction.state,
  );
  return (
    <section
      className="studio-idle-grid"
      aria-label={`${pool.length} expression idle variants`}
    >
      {pool.map((gesture, index) => (
        <IdleCard
          key={`${preview.coach.id}:${preview.family}:${preview.reaction.state}:${gesture}`}
          preview={preview}
          gesture={gesture}
          index={index}
        />
      ))}
    </section>
  );
}

export function CastComparison({ preview, selected }: {
  preview: StudioPreview;
  selected: string;
}) {
  const [comparisons, setComparisons] = useState(["woman-analyst", "frog"]);
  const [replay, setReplay] = useState(0);
  return (
    <section
      className="studio-cast-comparison"
      aria-label="Compare coaches on the same expression"
    >
      <div className="studio-section-title">
        <div>
          <p className="eyebrow">SAME MOMENT · DIFFERENT CHARACTER</p>
          <h2>Compare the cast</h2>
        </div>
        <button onClick={() => setReplay((value) => value + 1)}>
          <RotateCcw size={15} /> Replay comparison
        </button>
      </div>
      <div className="studio-comparison-grid">
        {[selected, ...comparisons].map((id, index) => {
          const coach = getCoach(id);
          return (
            <article className="studio-comparison-card" key={index}>
              {index === 0 ? (
                <p className="studio-comparison-selected">
                  Selected coach · {coach.name}
                </p>
              ) : (
                <label>
                  Compare coach {index}
                  <select
                    value={coach.id}
                    onChange={(event) => setComparisons((current) =>
                      current.map((value, at) =>
                        at === index - 1 ? event.target.value : value,
                      ),
                    )}
                  >
                    {selectableCoaches.map((option) => (
                      <option value={option.id} key={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <CoachCharacter
                coach={coach}
                reaction={preview.reaction}
                motion={preview.motion}
                replay={replay}
                label={`${coach.name}: ${expressionInfo[preview.reaction.state].label}`}
              />
              <p>{expressionInfo[preview.reaction.state].label}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
