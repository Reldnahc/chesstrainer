import ReviewCoach from "../../ReviewCoach";
import { CoachCharacter } from "../CoachAvatar";
import { ArrowRight } from "lucide-react";
import {
  expressionInfo,
  type CoachDefinition,
  type CoachMotion,
  type CoachReaction,
  type CoachMicro,
} from "../model";
import { examples } from "./examples";

export type StudioPreview = {
  coach: CoachDefinition;
  family: string;
  reaction: CoachReaction;
  motion: CoachMotion;
  replay: number;
  previewIdle: CoachMicro;
};

export function ConceptComparison({
  preview,
  onFamily,
}: {
  preview: StudioPreview;
  onFamily: (family: string) => void;
}) {
  const { coach, reaction, family } = preview;
  return (
    <section className="studio-concepts" aria-label="Compare concept families">
      {coach.families.map((direction, index) => (
        <article
          className={`studio-concept studio-${direction.id}`}
          key={direction.id}
        >
          <div className="studio-concept-top">
            <span>CONCEPT {String(index + 1).padStart(2, "0")}</span>
            {direction.id === coach.defaultFamily && (
              <span className="studio-current">In your reviews</span>
            )}
          </div>
          <div className="studio-character-stage">
            <div className="studio-character-halo" />
            <CoachCharacter
              {...preview}
              family={direction.id}
              label={`${direction.name}: ${expressionInfo[reaction.state].label}`}
            />
          </div>
          <div className="studio-concept-copy">
            <h3>{direction.name}</h3>
            <p>{direction.description}</p>
            <span>{direction.character}</span>
          </div>
          <button
            className="text-button"
            aria-pressed={family === direction.id}
            onClick={() => onFamily(direction.id)}
          >
            {family === direction.id
              ? "Viewing this collection"
              : "Explore this collection"}
            <ArrowRight size={15} />
          </button>
        </article>
      ))}
    </section>
  );
}

export function BoardSizePreview({ preview }: { preview: StudioPreview }) {
  const example = examples[preview.reaction.state];
  return (
    <section
      className="studio-context-section"
      aria-label="Actual interface size previews"
    >
      <div className="studio-section-title">
        <div>
          <p className="eyebrow">WHERE IT MATTERS</p>
          <h2>At board size</h2>
        </div>
        <p>
          Same component. Same reserved space.
          <br />
          Illustrative coaching; no chess analysis runs here.
        </p>
      </div>
      <div className="studio-contexts">
        {[false, true].map((compact) => (
          <article
            className={`studio-context ${compact ? "studio-context-compact" : ""}`}
            key={String(compact)}
          >
            <p className="studio-size-label">
              {compact ? "COMPACT PANEL · 52.5 PX" : "ROOMY PANEL · 92.8 PX"}
            </p>
            <ReviewCoach
              title={<strong>{example.title}</strong>}
              evaluation={
                <span className="evaluation-score">{example.evaluation}</span>
              }
              character={<CoachCharacter {...preview} />}
              actions={
                <>
                  <button disabled>Show why</button>
                  <span>Example position</span>
                </>
              }
            >
              <p>{example.text}</p>
            </ReviewCoach>
          </article>
        ))}
      </div>
    </section>
  );
}
