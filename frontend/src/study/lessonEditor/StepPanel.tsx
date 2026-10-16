import { Circle } from "lucide-react";
import Button from "../../Button";
import ChoiceGroup from "../../ChoiceGroup";
import Notice from "../../Notice";
import Reveal from "../../Reveal";
import { START_FEN } from "../../fen";
import Field, { CommittedInput } from "./Field";
import {
  KINDS,
  words,
  type Course,
  type Kind,
  type Recording,
  type Step,
  type StepBoard,
} from "./model";

const FOLLOWING = "__following__";
const END = "__end__";

/** The selected step's fields: its kind and each kind's own fields, where it goes
 * next, where it starts, and its board marks. Moves are recorded on the board. */
export default function StepPanel({
  course,
  step,
  number,
  kind,
  otherSteps,
  board,
  setKind,
  setField,
  editStep,
  rename,
  record,
}: {
  course: Course;
  step: Step;
  number: number;
  kind: Kind;
  otherSteps: Step[];
  board: StepBoard | undefined;
  setKind: (kind: Kind) => void;
  setField: (field: keyof Step, value: unknown) => void;
  editStep: (update: (draft: Step) => void) => void;
  /** Renames the step and every link to it. */
  rename: (id: string) => void;
  record: (field: Recording["field"]) => void;
}) {
  const nextValue = step.next === undefined ? FOLLOWING : step.next === null ? END : step.next;
  return (
    <section className="lesson-editor-section" aria-label="Selected step">
      <h2>
        Step {number}: {step.title || step.id}
      </h2>
      <div className="lesson-editor-fields">
        <Field label="Kind" help={KINDS.find(option => option.value === kind)?.help}>
          <select value={kind} onChange={event => setKind(event.target.value as Kind)}>
            {KINDS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <input value={step.title} onChange={event => setField("title", event.target.value)} />
        </Field>
        {/* Links to the step follow its id once it is committed, never per keystroke. */}
        <Field label="Step id" help="Other steps link to this name.">
          <CommittedInput value={step.id} onCommit={rename} />
        </Field>
        <Field label="Text">
          <textarea
            rows={4}
            value={step.text ?? ""}
            onChange={event => setField("text", event.target.value)}
          />
        </Field>

        {/* Each kind's own fields grow in and collapse out as the kind changes. */}
        <Reveal>
          {kind === "demonstration" && (
            <Field
              label="Moves to play"
              help="Ordinary notation, such as Nf3 Nc6."
              action={
                <Button size="compact" variant="secondary" onClick={() => record("show")}>
                  <Circle size={16} />
                  Record on the board
                </Button>
              }
            >
              <input
                value={step.show ?? ""}
                onChange={event => setField("show", event.target.value)}
              />
            </Field>
          )}
        </Reveal>
        <Reveal>
          {kind === "decision" &&
            (step.choices ? (
              <Notice announcement="passive">
                This decision accepts several moves. Edit its choices in the course file.
              </Notice>
            ) : (
              <div className="lesson-editor-fields">
                <Field
                  label="Learner's move"
                  action={
                    <Button size="compact" variant="secondary" onClick={() => record("decision")}>
                      <Circle size={16} />
                      Record move and reply
                    </Button>
                  }
                >
                  <input
                    value={step.move ?? ""}
                    onChange={event => setField("move", event.target.value)}
                  />
                </Field>
                <Field label="Opponent's reply" help="Optional.">
                  <input
                    value={step.reply ?? ""}
                    onChange={event => setField("reply", event.target.value)}
                  />
                </Field>
                <Field label="Hint" help="Shown when the learner asks for one.">
                  <input
                    value={step.hint ?? ""}
                    onChange={event => setField("hint", event.target.value)}
                  />
                </Field>
                <Field label="Feedback" help="Shown after the right move.">
                  <input
                    value={step.feedback ?? ""}
                    onChange={event => setField("feedback", event.target.value)}
                  />
                </Field>
              </div>
            ))}
        </Reveal>
        <Reveal>
          {kind === "branch" && (
            <Field
              label="Side trip starts at"
              help="The side trip's last step should end the chapter, so the learner returns here."
            >
              <select
                value={step.branch ?? ""}
                onChange={event => setField("branch", event.target.value)}
              >
                <option value="">Choose a step</option>
                {otherSteps.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.title} ({item.id})
                  </option>
                ))}
              </select>
            </Field>
          )}
        </Reveal>
        <Reveal>
          {kind === "rehearsal" && (
            <Field label="Line to rehearse">
              <select
                value={step.rehearse ?? ""}
                onChange={event => setField("rehearse", event.target.value)}
              >
                <option value="">Choose a line</option>
                {(course.lines ?? []).map(line => (
                  <option key={line.id} value={line.id}>
                    {line.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </Reveal>
        <Reveal>
          {kind === "game_excerpt" && (
            <div className="lesson-editor-fields">
              <Field label="Source game">
                <select
                  value={step.game ?? ""}
                  onChange={event => setField("game", event.target.value)}
                >
                  <option value="">Choose a game</option>
                  {(course.games ?? []).map(game => (
                    <option key={game.id} value={game.id}>
                      {game.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="From ply">
                <input
                  type="number"
                  min={0}
                  value={step.from ?? 0}
                  onChange={event => setField("from", Number(event.target.value))}
                />
              </Field>
              <Field label="To ply">
                <input
                  type="number"
                  min={1}
                  value={step.to ?? 1}
                  onChange={event => setField("to", Number(event.target.value))}
                />
              </Field>
            </div>
          )}
        </Reveal>

        <Field label="Then go to">
          <select
            value={nextValue}
            onChange={event =>
              setField(
                "next",
                event.target.value === FOLLOWING
                  ? undefined
                  : event.target.value === END
                    ? null
                    : event.target.value,
              )
            }
          >
            <option value={FOLLOWING}>The next step in the list</option>
            <option value={END}>End the chapter (or return from a side trip)</option>
            {otherSteps.map(item => (
              <option key={item.id} value={item.id}>
                {item.title} ({item.id})
              </option>
            ))}
          </select>
        </Field>
        <Field group label="Starts from" help="Most steps carry on from the step before them.">
          <ChoiceGroup
            label="Starts from"
            value={step.position !== undefined || step.fen !== undefined ? "own" : "carry"}
            onChange={value =>
              editStep(draft => {
                if (value === "own") {
                  draft.position = board?.position ?? "";
                  if (board && board.initial_fen !== START_FEN) draft.fen = board.initial_fen;
                } else {
                  delete draft.position;
                  delete draft.fen;
                }
              })
            }
            options={[
              { value: "carry", label: "Carries on" },
              { value: "own", label: "Its own position" },
            ]}
          />
        </Field>
        <Reveal>
          {(step.position !== undefined || step.fen !== undefined) && (
            <div className="lesson-editor-fields">
              <Field
                label="Moves from the start"
                action={
                  <Button size="compact" variant="secondary" onClick={() => record("position")}>
                    <Circle size={16} />
                    Record on the board
                  </Button>
                }
              >
                <input
                  value={step.position ?? ""}
                  onChange={event => setField("position", event.target.value)}
                />
              </Field>
              <Field
                label="Starting FEN"
                help="Optional, for an example that does not start from the initial position."
              >
                <input
                  value={step.fen ?? ""}
                  onChange={event => setField("fen", event.target.value || undefined)}
                />
              </Field>
            </div>
          )}
        </Reveal>
        <Field label="Highlighted squares" help="Such as e4 d5.">
          <input
            value={(step.squares ?? []).join(" ")}
            onChange={event =>
              setField(
                "squares",
                words(event.target.value).length ? words(event.target.value) : undefined,
              )
            }
          />
        </Field>
        <Field label="Arrows" help="Such as c3-d5 f1-b5.">
          <input
            value={(step.arrows ?? []).join(" ")}
            onChange={event =>
              setField(
                "arrows",
                words(event.target.value).length ? words(event.target.value) : undefined,
              )
            }
          />
        </Field>
      </div>
    </section>
  );
}
