import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { api, read, type Schema } from "../api";
import ActionLink from "../ActionLink";
import Button from "../Button";
import ChoiceGroup from "../ChoiceGroup";
import Notice from "../Notice";
import PageTitle from "../PageTitle";
import { LoadingState } from "../LoadState";
import CoachAvatar from "../coach/CoachAvatar";
import { useSelectedCoachSpokenText } from "../audio/speech/spokenText";
import { useCoachSpeech } from "../audio/speech/useCoachSpeech";
import { PLAY_INVITATION } from "../audio/speech/voiceBank";
import { useCoachPreferences } from "../coach/CoachProvider";
import { getCoach } from "../coach/registry";
import { navigate, playGamePath } from "../navigation";
import PlayGame from "./PlayGame";

type Profile = Schema["PlayProfile"];
type Opponent = Schema["PlayRequest"]["opponent"];
type Color = Schema["PlayRequest"]["color"];

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
const LEVELS = [
  { value: "match", label: "Match my level" },
  { value: "choose", label: "Choose a rating" },
] as const;

export default function PlayScreen({ gameId }: { gameId: string | null }) {
  if (gameId) return <PlayGame id={gameId} />;
  return <PlaySetup />;
}

function PlaySetup() {
  const { preferences } = useCoachPreferences();
  const coach = getCoach(preferences.coach_id);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [active, setActive] = useState<Schema["PlayState"] | null>(null);
  const [level, setLevel] = useState<(typeof LEVELS)[number]["value"]>("match");
  const [opponent, setOpponent] = useState<Opponent>("human");
  const [rating, setRating] = useState(1200);
  const [color, setColor] = useState<Color>("random");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    document.title = "Play · Fieldwork";
  }, []);
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const load = () =>
      read(api.GET("/api/play/profile"))
        .then((value) => {
          if (!active) return;
          setProfile(value);
          // The fit runs in the background after imports; poll until it settles.
          if (value.status === "computing") timer = window.setTimeout(load, 3000);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    load();
    read(api.GET("/api/play/active"))
      .then((value) => {
        if (active) setActive(value.game);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);
  // The coach asks for a game when the page opens: its clip plays when recorded,
  // and the bubble shows the line either way.
  // The page opening is the narration event, raised once the clip can play so
  // that loading preferences never swallows it.
  const [invited, setInvited] = useState<string | null>(null);
  const voice = useCoachSpeech({ scopeKey: `play-setup:${coach.id}`, recordingId: PLAY_INVITATION,
    automaticEventId: invited });
  const playable = voice.canPlay(PLAY_INVITATION);
  useEffect(() => {
    if (playable) setInvited(`play-setup:${coach.id}`);
  }, [playable, coach.id]);
  const invitation = useSelectedCoachSpokenText(PLAY_INVITATION);
  const range = opponent === "human" ? HUMAN : ENGINE;
  const clamped = Math.max(range.min, Math.min(range.max, rating));
  const matched = profile?.default_rating ?? 1200;
  const chosen = level === "match" && opponent === "human" ? matched : clamped;
  async function start() {
    setStarting(true);
    setError("");
    try {
      const game = await read(
        api.POST("/api/play", {
          body: { coach_id: coach.id, coach_name: coach.name, color, opponent, rating: chosen },
        }),
      );
      navigate(playGamePath(game.id));
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
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
      <PageTitle eyebrow="YOUR MOVE" title={`Play ${coach.name}`} />
      {error && <Notice announcement="alert" tone="error">{error}</Notice>}
      {active && (
        <section className="panel play-resume" aria-label="Game in progress">
          <span>You have a game in progress against {active.coach_name}.</span>
          <ActionLink variant="secondary" href={playGamePath(active.id)}>
            Continue the game <ArrowRight size={16} aria-hidden="true" />
          </ActionLink>
        </section>
      )}
      <div className="play-setup">
        <section className="panel play-setup-form" aria-label="Game setup">
          <div className="play-field">
            <span id="play-opponent">Opponent</span>
            <ChoiceGroup label="Opponent" options={OPPONENTS} value={opponent} onChange={(value) => {
              setOpponent(value);
              if (value === "engine") setLevel("choose");
            }} />
            {/* Both descriptions share one cell so switching never changes its height. */}
            <div className="play-swap">
              <p className="small muted" hidden={opponent !== "human"}>
                {coach.name} plays like a person at the chosen rating: the mistakes of that level, not an engine's random ones.
              </p>
              <p className="small muted" hidden={opponent !== "engine"}>
                {coach.name} plays engine chess at a limited strength. Stockfish cannot imitate players below 1800.
              </p>
            </div>
          </div>
          <div className="play-field">
            <span>Strength</span>
            {/* The engine cannot match a human level; keep the choice visible but unavailable. */}
            <ChoiceGroup label="Strength" value={opponent === "human" ? level : "choose"} onChange={setLevel}
              options={LEVELS.map(option => ({ ...option, disabled: opponent !== "human" && option.value === "match" }))} />
            <div className="play-swap">
              <div className="play-level" hidden={!(level === "match" && opponent === "human")}>
                <strong>{profile?.status === "computing" && !profile.fitted_rating ? "…" : matched}</strong>
                <span className="small muted">{fitLine}</span>
              </div>
              <div className="play-strength" hidden={level === "match" && opponent === "human"}>
                <input id="play-rating" type="range" aria-label="Opponent rating" min={range.min} max={range.max}
                  step={range.step} value={clamped} onChange={(event) => setRating(Number(event.target.value))} />
                <output htmlFor="play-rating">{clamped}</output>
              </div>
            </div>
          </div>
          <div className="play-field">
            <span>Your color</span>
            <ChoiceGroup label="Your color" options={COLORS} value={color} onChange={setColor} />
          </div>
          <p className="small muted">
            {coach.name} comments on every move as you play, with the evaluation and the graph, like a review of a game in progress. {coach.name} answers after having its say.
          </p>
          <div className="button-row">
            <Button variant="primary" onClick={start} disabled={starting}>
              {starting ? "Starting…" : `Play ${coach.name}`}
            </Button>
          </div>
        </section>
        <div className="play-setup-coach">
          <div className="play-setup-portrait">
            <CoachAvatar reaction={{ key: "play-setup", state: "neutral" }} speech={voice.speech} speechTrack={voice.speechTrack} />
          </div>
          {invitation && (
            <div className="play-setup-speech" aria-label={`${coach.name} says`}>
              <p>{invitation}</p>
              {voice.control}
            </div>
          )}
        </div>
      </div>
      {!profile && !error && <LoadingState>Loading…</LoadingState>}
    </>
  );
}
