import { useRef, useState } from "react";
import { usePageTitle } from "../PageTitle";
import Banner from "../Banner";
import { ArrowLeft, ArrowRight, Play } from "lucide-react";
import { api, read } from "../api";
import { useAudioScope } from "../audio/AudioProvider";
import { useCoachSpeech } from "../audio/speech/useCoachSpeech";
import { useSelectedCoachSpokenText } from "../audio/speech/spokenText";
import Board from "../Board";
import { moveSquares } from "../boardCues";
import ActionLink from "../ActionLink";
import Button from "../Button";
import ChoiceGroup from "../ChoiceGroup";
import ContinuationMoves from "../ContinuationMoves";
import MovePlaybackControls from "../MovePlaybackControls";
import AudioMuteButton from "../audio/AudioMuteButton";
import ReviewCoach from "../ReviewCoach";
import Reveal from "../Reveal";
import ReviewWorkspace from "../ReviewWorkspace";
import SourceLine from "../SourceLine";
import {
  lessonCoursePath,
  lessonSessionPath,
  openingCataloguePath,
  openingStudiesPath,
  studyPaths,
} from "../navigation";
import { createPracticeStarter, setStudyActive } from "./openingApi";
import { CommandError, QueryResult, useCommand, useQuery } from "../useQuery";
import { useSessionStart } from "../useSessionStart";
import { plural, pluralWord } from "../format";

export default function OpeningLinePreview({
  catalogueKey,
  courseLine,
}: {
  catalogueKey: string | null;
  courseLine: {
    courseId: string;
    lineId: string;
    revision: string;
    color?: "white" | "black";
  } | null;
}) {
  const [color, setColor] = useState<"white" | "black">(courseLine?.color ?? "white");
  const [ply, setPly] = useState(0);
  const command = useCommand();
  // Adding the line and practising it share one guard, so only one runs at a time.
  const starting = useSessionStart(
    createPracticeStarter,
    session => lessonSessionPath(session.id),
    command,
  );
  const busy = !!command.busy;
  const [saved, setSaved] = useState(false);
  const audio = useAudioScope(
    `opening-preview:${catalogueKey || `${courseLine?.courseId}:${courseLine?.lineId}:${courseLine?.revision}`}`,
  );
  const navigationId = useRef(0);
  function seek(next: number) {
    if (!line || next === ply || next < 0 || next > line.frames.length) return;
    audio.cancel();
    const eventId = `seek:${++navigationId.current}`;
    audio.step(ply, next, line.frames[next - 1]?.san, eventId);
    setPly(next);
  }
  // The route keys this screen by its line, so another line always loads fresh.
  const query = useQuery(async signal => {
    const selected = catalogueKey
      ? read(
          api.GET("/api/openings/catalog/{key}", {
            params: { path: { key: catalogueKey } },
            signal,
          }),
        )
      : read(
          api.GET("/api/openings/course-lines/{course_id}/{line_id}", {
            params: {
              path: { course_id: courseLine!.courseId, line_id: courseLine!.lineId },
              query: { revision: courseLine!.revision },
            },
            signal,
          }),
        );
    const [result, library] = await Promise.all([
      selected,
      read(api.GET("/api/opening-studies", { signal })),
    ]);
    if (!signal.aborted)
      setColor(preferred =>
        result[`${preferred}_positions`] ? preferred : preferred === "white" ? "black" : "white",
      );
    return { line: result, studies: library.items };
  });
  const line = query.data?.line;
  const studies = query.data?.studies ?? [];
  usePageTitle(line?.line.name);
  const selectedStudy =
    line &&
    studies.find(
      study =>
        study.source === line.line.source &&
        study.source_key === line.line.source_key &&
        study.source_version === line.line.source_version &&
        study.color === color,
    );
  function enroll() {
    if (!line || selectedStudy?.active) return;
    void command.run(
      true,
      signal =>
        selectedStudy
          ? setStudyActive(selectedStudy.id, true, signal)
          : read(
              api.POST("/api/opening-studies", {
                body: {
                  source: line.line.source,
                  source_key: line.line.source_key,
                  source_version: line.line.source_version,
                  course_id: line.line.course_id,
                  line_id: line.line.line_id,
                  color,
                },
                signal,
              }),
            ),
      result => {
        query.setData(previous => ({
          line: previous!.line,
          studies: [...previous!.studies.filter(study => study.id !== result.id), result],
        }));
        setSaved(true);
      },
    );
  }
  function practice() {
    if (selectedStudy) void starting.start(true, selectedStudy.id);
  }
  const back = courseLine
    ? lessonCoursePath(courseLine.courseId, courseLine.revision)
    : openingCataloguePath();
  const recordingId = line
    ? selectedStudy?.active
      ? "opening-preview-active"
      : "opening-preview-inactive"
    : null;
  const voice = useCoachSpeech({
    scopeKey: `opening-preview:${line?.line.source_key}:${line?.line.source_version}:${color}:${ply}:${!!selectedStudy?.active}`,
    recordingId,
    ready: !!line && !busy && !command.error,
  });
  // The preview's single coach sentence is shown as the coach says it.
  const spoken = useSelectedCoachSpokenText(recordingId);
  // The back link stays mounted (and keeps focus) while the load turns into an error.
  if (!line)
    return (
      <section className="panel">
        <h1>Opening preview</h1>
        <QueryResult query={query} label="the selected line">
          {() => null}
        </QueryResult>
        <ActionLink variant="secondary" href={back}>
          <ArrowLeft size={16} />
          Back to openings
        </ActionLink>
      </section>
    );
  const frame = ply ? line.frames[ply - 1] : null;
  const positions = color === "white" ? line.white_positions : line.black_positions;
  return (
    <ReviewWorkspace
      heading={
        <>
          <h1>{line.line.name}</h1>
          {line.line.eco && <span>{line.line.eco}</span>}
        </>
      }
      boardLabel="Opening line preview"
      aboveBoard={
        <div className="review-position-status">
          <span>Line preview</span>
          <span>
            {ply} / {line.frames.length} PLIES
          </span>
        </div>
      }
      belowBoard={
        <div className="review-board-hint">
          {frame ? frame.san : "Starting position"} · Preview the continuation before adding it to
          study.
        </div>
      }
      boardControls={
        <div className="lesson-board-controls">
          <ActionLink variant="secondary" href={back}>
            <ArrowLeft size={16} />
            Back
          </ActionLink>
          <MovePlaybackControls
            label="Opening line playback"
            current={ply}
            maximum={line.frames.length}
            previous={{
              "aria-label": "Previous line move",
              disabled: !ply,
              onClick: () => seek(ply - 1),
            }}
            next={{
              "aria-label": "Next line move",
              disabled: ply === line.frames.length,
              onClick: () => seek(ply + 1),
            }}
          />
          <AudioMuteButton />
        </div>
      }
      board={
        <Board
          fen={frame?.after_fen || line.line.initial_fen}
          orientation={color}
          disabled
          highlights={moveSquares(frame?.uci)}
        />
      }
    >
      <ReviewCoach
        title={
          <h2>
            {selectedStudy?.active ? "This line is in your study." : "Choose what to remember."}
          </h2>
        }
        voice={voice}
        reaction={{
          state: "explaining",
          key: `${line.line.source_key}:${color}:${!!selectedStudy?.active}`,
        }}
        actions={
          <>
            <Button
              size="compact"
              variant="primary"
              disabled={busy || !positions || !!selectedStudy?.active}
              onClick={enroll}
            >
              {selectedStudy?.active
                ? "Added to study"
                : selectedStudy
                  ? "Resume recalls"
                  : "Add to study"}
              <ArrowRight size={16} />
            </Button>
            {selectedStudy && (
              <Button size="compact" variant="secondary" disabled={busy} onClick={practice}>
                <Play size={16} />
                Practice line
              </Button>
            )}
          </>
        }
      >
        <p>
          {spoken ??
            (selectedStudy?.active
              ? "This line’s moves are accepted in mixed Due. Dedicated practice asks for this line alone."
              : "Scheduled recalls will ask for your selected side’s moves. Shared positions use one card across your active studies.")}
        </p>
      </ReviewCoach>
      <CommandError command={command} />
      {saved && (
        <Banner tone="success" onDismiss={() => setSaved(false)}>
          Study saved. Eligible positions are now included in Due.
        </Banner>
      )}
      <section className="panel opening-preview-details">
        <ChoiceGroup
          label="Study as"
          showLabel
          value={color}
          onChange={side => {
            setColor(side);
            setSaved(false);
          }}
          options={(["white", "black"] as const).map(side => {
            const decisions = side === "white" ? line.white_positions : line.black_positions;
            return {
              value: side,
              label: `${side === "white" ? "White" : "Black"} · ${plural(decisions, "decision")}`,
              disabled: busy || !decisions,
            };
          })}
        />
        <h2>The selected continuation</h2>
        <ContinuationMoves
          label="Opening continuation"
          moves={line.frames}
          numbered
          selectedIndex={ply - 1}
          startSelected={!ply}
          onStart={() => seek(0)}
          onSelect={index => seek(index + 1)}
        />
        <p className="small muted">
          {positions} {color === "white" ? "White" : "Black"} recall{" "}
          {pluralWord(positions, "decision")}. This line does not cover every opponent response.
        </p>
        <div className="button-row">
          <ActionLink variant="secondary" href={openingStudiesPath}>
            My studies
          </ActionLink>
          <Reveal axis="inline">
            {selectedStudy?.active && (
              <ActionLink variant="primary" href={studyPaths.due}>
                Go to Due
              </ActionLink>
            )}
          </Reveal>
        </div>
        <SourceLine
          className="opening-source"
          text={
            line.line.source === "lichess_catalogue"
              ? "Lichess opening catalogue"
              : "Authored course repertoire line"
          }
          license={line.line.source === "lichess_catalogue" ? "CC0" : undefined}
          revision={line.line.source_version}
        />
      </section>
    </ReviewWorkspace>
  );
}
