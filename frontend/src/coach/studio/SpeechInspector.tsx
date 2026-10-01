import { useState } from "react";
import ChoiceGroup from "../../ChoiceGroup";
import ReviewCoach from "../../ReviewCoach";
import Notice from "../../Notice";
import { CoachCharacter } from "../CoachAvatar";
import { expressionInfo, supportsSpeech, type CoachDefinition, type CoachExpression } from "../model";
import type { SpeechMouthShape } from "../speechMouth";
import "./speech-inspector.css";

// Labels describe the shared phoneme adapter, not one character's SVG geometry.
const shapes: readonly { shape: SpeechMouthShape; name: string; sounds: string; example: string }[] = [
  { shape: "rest", name: "Rest", sounds: "Silence", example: "Relaxed speaking rest" },
  { shape: "closed", name: "Closed", sounds: "M · B · P", example: "Lips meet, as in “map”" },
  { shape: "consonant", name: "Narrow", sounds: "IY · IH · SH · T", example: "A small opening, as in “see”" },
  { shape: "open", name: "Open", sounds: "AH · EH · AE", example: "An open vowel, as in “bed”" },
  { shape: "wide", name: "Wide", sounds: "AA", example: "The broad vowel in “father”" },
  { shape: "round", name: "Rounded", sounds: "AO · ER · R · UH", example: "Rounded, as in “thought”" },
  { shape: "pucker", name: "Puckered", sounds: "W · UW", example: "Lips forward, as in “woo”" },
  { shape: "lip-bite", name: "Lip bite", sounds: "F · V", example: "Lower lip meets upper teeth" },
  { shape: "tongue", name: "Tongue", sounds: "L", example: "Tongue lifted, as in “look”" },
];

export default function SpeechInspector({ coach, expression }: {
  coach: CoachDefinition;
  expression: CoachExpression;
}) {
  const [size, setSize] = useState<"board" | "large">("board");
  const supported = supportsSpeech(coach);
  const reaction = { state: expression, key: `speech-inspector:${coach.id}:${expression}` };
  return <section className="speech-inspector" aria-labelledby="speech-inspector-title">
    <header className="studio-section-title">
      <div>
        <p className="eyebrow">THE SPEAKING RIG</p>
        <h2 id="speech-inspector-title">{coach.name} · Mouth shapes</h2>
      </div>
      <ChoiceGroup label="Mouth preview size" value={size} onChange={setSize}
        options={[{ value: "board", label: "Board size" }, { value: "large", label: "Larger" }]} />
    </header>
    <p className="speech-inspector-note">
      Nine held poses from the real artwork, with representative phoneme cues.
      Inspection is static; recorded previews below follow the motion setting.
    </p>
    {!supported && <Notice announcement="status" appearance="inline">
      This coach does not have a speaking rig yet. Each tile preserves the authored expression.
    </Notice>}
    <div className="speech-inspector-grid" data-size={size} role="group" aria-label="Held mouth shapes">
      {shapes.map(({ shape, name, sounds, example }) => <figure className="speech-shape" key={shape} data-shape={shape}>
        <div className="speech-shape-stage">
          <CoachCharacter coach={coach} reaction={reaction} motion="still" idle={false}
            previewSpeechShape={shape} label={`${coach.name}: ${name.toLowerCase()} mouth`} />
        </div>
        <figcaption>
          <strong>{name}</strong>
          <span>{sounds}</span>
          <small>{example}</small>
        </figcaption>
      </figure>)}
    </div>
    <div className="speech-authored-reference">
      <ReviewCoach title={<strong>Authored {expressionInfo[expression].label.toLowerCase()} expression</strong>}
        character={<CoachCharacter coach={coach} reaction={reaction} motion="still" idle={false}
          label={`${coach.name}: authored expression without speech`} />} actions={null}>
        <p>This is the original mouth when no clip is playing. Speech returns here when it ends.</p>
      </ReviewCoach>
    </div>
  </section>;
}
