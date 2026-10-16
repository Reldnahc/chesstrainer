import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { api, read, type Schema } from "../api";
import ActionLink from "../ActionLink";
import Button from "../Button";
import ChoiceGroup from "../ChoiceGroup";
import Notice from "../Notice";
import PageTitle from "../PageTitle";
import { LoadingState } from "../LoadState";
import { CommandError, QueryError, QueryResult, usePolledQuery, useQuery } from "../useQuery";
import { useSessionStart } from "../useSessionStart";
import CoachAvatar from "../coach/CoachAvatar";
import ReviewCoach from "../ReviewCoach";
import { useSelectedCoachSpokenText } from "../audio/speech/spokenText";
import { useCoachSpeech } from "../audio/speech/useCoachSpeech";
import { PLAY_INVITATION } from "../audio/speech/voiceBank";
import { useCoachPreferences } from "../coach/CoachProvider";
import { getCoach } from "../coach/registry";
import { playGamePath } from "../navigation";
import PlayGame from "./PlayGame";
import usePhone from "../usePhone";

type Profile = Schema["PlayProfile"];
type Opponent = Schema["PlayRequest"]["opponent"];
type Color = Schema["PlayRequest"]["color"];
type PracticeCourse = Schema["PracticeCourse"];

// Measured ranges: Maia's rating dial scales play up to about 2500; Stockfish's
// own limiter cannot imitate anyone weaker than a strong club player.
const HUMAN = { min: 600, max: 2500, step: 50 } as const;
const ENGINE = { min: 1800, max: 2600, step: 50 } as const;
const COLORS: readonly { value: Color; label: string }[] = [
  { value: "random", label: "Random" },
  { value: "white", label: "White" },
  { value: "black", label: "Black" },
];
const OPPONENTS: readonly { value: Opponent; label: string }[] = [
  { value: "human", label: "Human-like" },
  { value: "engine", label: "Engine" },
];
const MODES = [
  { value: "free", label: "Any opening" },
  { value: "practice", label: "Practice an opening" },
] as const;
const LEVELS = [
  { value: "match", label: "Match my level" },
  { value: "choose", label: "Choose a rating" },
] as const;

export default function PlayScreen({ gameId, from }: { gameId: string | null; from: string | null }) {
  // Keyed so "Go again" starts the new game with a fresh session.
  if (gameId) return <PlayGame key={gameId} id={gameId} />;
  return <PlaySetup from={from} />;
}

// Phones use the shared ReviewCoach layout; desktop keeps the large portrait.
function PlaySetup({ from }: { from: string | null }) {
  const phone = usePhone();
  const { preferences } = useCoachPreferences();
  const coach = getCoach(preferences.coach_id);
  const [level, setLevel] = useState<(typeof LEVELS)[number]["value"]>("match");
  const [opponent, setOpponent] = useState<Opponent>("human");
  const [rating, setRating] = useState(1200);
  const [color, setColor] = useState<Color>("random");
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("free");
  const [courseId, setCourseId] = useState("");
  const starting = useSessionStart(() => (body: Schema["PlayRequest"], signal?: AbortSignal) =>
    read(api.POST("/api/play", { body, signal })), (game) => playGamePath(game.id));
  // The fit runs in the background after imports; poll until it settles. A failed
  // read is reported once and retried with a growing wait rather than given up.
  const [measuring, setMeasuring] = useState(true);
  const profileQuery = usePolledQuery(async (signal) => {
    const value = await read(api.GET("/api/play/profile", { signal }));
    if (!signal.aborted) setMeasuring(value.status === "computing");
    return value;
  }, { intervalMs: 3000, enabled: measuring });
  const profile: Profile | null = profileQuery.data ?? null;
  // The setup waits for the first answer about the level, then stays: a Try again
  // on the level's banner never hides the form while it reads.
  const [levelAnswered, setLevelAnswered] = useState(false);
  if (!levelAnswered && !profileQuery.pending) setLevelAnswered(true);
  // The setup waits for whether a game is in progress and for the practice
  // courses (each falls back on failure), and "New game" after a game starts
  // from that game's settings, so none of them moves the setup after it appears.
  const setup = useQuery(async (signal) => {
    const [loadedCourses, active, previous] = await Promise.all([
      read(api.GET("/api/play/openings", { signal })).then(value => value.courses, (): PracticeCourse[] => []),
      read(api.GET("/api/play/active", { signal })).then(value => value.game, () => null),
      from ? read(api.GET("/api/play/{play_id}", { params: { path: { play_id: from } }, signal })).catch(() => undefined) : undefined,
    ]);
    if (!signal.aborted) {
      setCourseId((current) => current || loadedCourses[0]?.id || "");
      if (previous) {
        setOpponent(previous.opponent);
        setRating(previous.rating);
        setLevel(previous.opponent === "human" && previous.rating === previous.learner_rating ? "match" : "choose");
        setColor(previous.learner_color);
        setMode(previous.practice ? "practice" : "free");
        if (previous.practice) setCourseId(previous.practice.course_id);
      }
    }
    return { courses: loadedCourses, active };
  }, [from]);
  const courses = setup.data?.courses ?? [];
  const active = setup.data?.active ?? null;
  // The coach asks for a game when the page opens: its clip plays when recorded,
  // and the bubble shows the line either way.
  // The page opening is the narration event, raised once the clip can play so
  // that loading preferences never swallows it.
  const [invited, setInvited] = useState<string | null>(null);
  const voice = useCoachSpeech({ scopeKey: `play-setup:${coach.id}`, recordingId: PLAY_INVITATION,
    automaticEventId: invited });
  const playable = voice.canPlay(PLAY_INVITATION);
  const invitationEvent = `play-setup:${coach.id}`;
  if (playable && invited !== invitationEvent) setInvited(invitationEvent);
  const invitation = useSelectedCoachSpokenText(PLAY_INVITATION);
  // Human-like play needs the human move model; without it only the engine is offered.
  const humanModel = profile?.human_model ?? true;
  const shownOpponent: Opponent = humanModel ? opponent : "engine";
  const range = shownOpponent === "human" ? HUMAN : ENGINE;
  const clamped = Math.max(range.min, Math.min(range.max, rating));
  const matched = profile?.default_rating ?? 1200;
  const chosen = level === "match" && shownOpponent === "human" ? matched : clamped;
  // Practice plays the course's side; the color choice shows it but cannot change it.
  const picked = courses.find((item) => item.id === courseId) ?? null;
  const course = mode === "practice" ? picked : null;
  const shownColor: Color = course ? course.learner_color : color;
  function start() {
    void starting.start("play", {
      coach_id: coach.id, coach_name: coach.name, color: shownColor, opponent: shownOpponent, rating: chosen,
      ...(course ? { course_id: course.id } : {}),
    });
  }
  const fitLine = !profile
    ? "Measuring your level from your games…"
    : profile.status === "ready" && profile.fitted_rating
      ? `Measured from ${profile.positions} of your own decisions across ${profile.games} imported games${profile.platform_rating ? `, where you were rated ${profile.platform_rating}` : ""}.`
      : profile.status === "computing"
        ? "Measuring your level from your imported games. The bot plays at a provisional level until that finishes."
        : profile.status === "no_games"
          ? "Import some of your games and the bot will measure your level from them."
          : "The human move model is not available, so the bot uses a provisional level.";
  return (
    <>
      <PageTitle title={`Play ${coach.name}`} documentTitle="Play" />
      <CommandError command={starting} />
      <QueryError query={profileQuery} label="your measured level" />
      {active && (
        <section aria-label="Game in progress">
          <Notice announcement="passive" actions={<ActionLink variant="secondary" size="compact" href={playGamePath(active.id)}>
            Continue the game <ArrowRight size={16} aria-hidden="true" />
          </ActionLink>}>
            You have a game in progress against {coach.name}.
          </Notice>
        </section>
      )}
      <QueryResult query={setup} label="the game setup" presentation="panel">{() => !levelAnswered
        ? <LoadingState presentation="panel">Loading the game setup…</LoadingState> : (
      <div className="play-setup">
        <section className="panel play-setup-form" aria-label="Game setup">
          <div className="play-field">
            <span id="play-mode">Opening</span>
            <ChoiceGroup label="Opening" labelId="play-mode" value={mode} onChange={setMode}
              options={MODES.map(option => ({ ...option, disabled: option.value === "practice" && !courses.length }))} />
            {/* The course picker stays in place, unavailable until practice is chosen, so
                choosing practice never pushes the rows below it down. */}
            <select className="play-course" aria-label="Course to practice" value={courseId}
              disabled={mode !== "practice"} onChange={(event) => setCourseId(event.target.value)}>
              {courses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <div className="play-swap">
              <p className="small muted" hidden={mode !== "free"}>
                {coach.name} chooses its own opening moves.
              </p>
              <p className="small muted" hidden={mode !== "practice"}>
                {picked ? `You play ${picked.learner_color === "white" ? "White" : "Black"}. ` : ""}
                {coach.name} plays the course's lines and stops you when you leave them.
              </p>
            </div>
          </div>
          <div className="play-field">
            <span id="play-opponent">Opponent</span>
            <ChoiceGroup label="Opponent" labelId="play-opponent" value={shownOpponent} onChange={(value) => {
              setOpponent(value);
              if (value === "engine") setLevel("choose");
            }} options={OPPONENTS.map(option => ({ ...option, disabled: option.value === "human" && !humanModel }))} />
            {/* Both descriptions share one cell so switching never changes its height. */}
            <div className="play-swap">
              <p className="small muted" hidden={shownOpponent !== "human"}>
                {coach.name} plays like a person at the chosen rating: the mistakes of that level, not an engine's random ones.
              </p>
              <p className="small muted" hidden={shownOpponent !== "engine"}>
                {coach.name} plays engine chess at a limited strength. Stockfish cannot imitate players below 1800.
                {!humanModel && " Human-like play needs the human move model, which is not available."}
              </p>
            </div>
          </div>
          <div className="play-field">
            <span id="play-strength">Strength</span>
            {/* The engine cannot match a human level; keep the choice visible but unavailable. */}
            <ChoiceGroup label="Strength" labelId="play-strength" value={shownOpponent === "human" ? level : "choose"} onChange={setLevel}
              options={LEVELS.map(option => ({ ...option, disabled: shownOpponent !== "human" && option.value === "match" }))} />
            <div className="play-swap">
              <div className="play-level" hidden={!(level === "match" && shownOpponent === "human")}>
                <strong>{profile?.status === "computing" && !profile.fitted_rating ? "…" : matched}</strong>
                <span className="small muted">{fitLine}</span>
              </div>
              <div className="play-strength" hidden={level === "match" && shownOpponent === "human"}>
                <input id="play-rating" type="range" aria-label="Opponent rating" min={range.min} max={range.max}
                  step={range.step} value={clamped} onChange={(event) => setRating(Number(event.target.value))} />
                <output htmlFor="play-rating">{clamped}</output>
              </div>
            </div>
          </div>
          <div className="play-field">
            <span id="play-color">Your color</span>
            <ChoiceGroup label="Your color" labelId="play-color" value={shownColor} onChange={setColor}
              options={COLORS.map(option => ({ ...option, disabled: !!course && option.value !== course.learner_color }))} />
          </div>
          <p className="small muted">
            {coach.name} comments on every move as you play, with the evaluation and the graph, like a review of a game in progress. {coach.name} answers as soon as your move is graded.
          </p>
          <div className="button-row">
            <Button variant="primary" onClick={start} disabled={!!starting.busy}>
              {starting.busy ? "Starting…" : `Play ${coach.name}`}
            </Button>
          </div>
        </section>
        {phone && invitation ? (
          <div className="play-setup-coach">
            <ReviewCoach title={<strong>{coach.name}</strong>} voice={voice} fit="content"
              reaction={{ key: "play-setup", state: "neutral" }}>
              <p aria-label={`${coach.name} says`}>{invitation}</p>
            </ReviewCoach>
          </div>
        ) : (
        <div className="play-setup-coach">
          {invitation && (
            <div className="play-setup-speech" aria-label={`${coach.name} says`}>
              <div className="coach-label">
                <div className="coach-title"><strong>{coach.name}</strong></div>
                {voice.control && <div className="coach-label-actions">{voice.control}</div>}
              </div>
              <div className="coach-message"><p>{invitation}</p></div>
            </div>
          )}
          <div className="play-setup-portrait">
            <CoachAvatar reaction={{ key: "play-setup", state: "neutral" }} speech={voice.speech} speechTrack={voice.speechTrack} />
          </div>
        </div>
        )}
      </div>
      )}</QueryResult>
    </>
  );
}
