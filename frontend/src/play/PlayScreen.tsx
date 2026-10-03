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
import { useCoachPreferences } from "../coach/CoachProvider";
import { getCoach } from "../coach/registry";
import { navigate, playGamePath } from "../navigation";
import PlayGame from "./PlayGame";

type Profile = Schema["PlayProfile"];
type Opponent = Schema["PlayRequest"]["opponent"];
type Commentary = Schema["PlayRequest"]["commentary"];
type Color = Schema["PlayRequest"]["color"];

// Measured ranges: Maia's rating dial scales play up to about 2500; Stockfish's
// own limiter cannot imitate anyone weaker than a strong club player.
const HUMAN = { min: 600, max: 2500, step: 50 } as const;
const ENGINE = { min: 1800, max: 2600, step: 50 } as const;
const COMMENTARY: readonly { value: Commentary; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "request", label: "On request" },
  { value: "after", label: "After the game" },
];
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
  const [commentary, setCommentary] = useState<Commentary>("live");
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
          body: { coach_id: coach.id, coach_name: coach.name, color, opponent, rating: chosen, commentary },
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
            <p className="small muted">
              {opponent === "human"
                ? `${coach.name} plays like a person at the chosen rating: the mistakes of that level, not an engine's random ones.`
                : `${coach.name} plays engine chess at a limited strength. Stockfish cannot imitate players below 1800.`}
            </p>
          </div>
          <div className="play-field">
            <span>Strength</span>
            {opponent === "human" && <ChoiceGroup label="Strength" options={LEVELS} value={level} onChange={setLevel} />}
            {level === "match" && opponent === "human" ? (
              <div className="play-level">
                <strong>{profile?.status === "computing" && !profile.fitted_rating ? "…" : matched}</strong>
                <span className="small muted">{fitLine}</span>
              </div>
            ) : (
              <div className="play-strength">
                <input id="play-rating" type="range" aria-label="Opponent rating" min={range.min} max={range.max}
                  step={range.step} value={clamped} onChange={(event) => setRating(Number(event.target.value))} />
                <output htmlFor="play-rating">{clamped}</output>
              </div>
            )}
          </div>
          <div className="play-field">
            <span>Your color</span>
            <ChoiceGroup label="Your color" options={COLORS} value={color} onChange={setColor} />
          </div>
          <div className="play-field">
            <span>{coach.name} talks</span>
            <ChoiceGroup label="Commentary" options={COMMENTARY} value={commentary} onChange={setCommentary} />
            <p className="small muted">
              {commentary === "live"
                ? "Every move is graded as you play, with the evaluation and the coach's reaction, like a review of a game in progress."
                : commentary === "request"
                  ? `${coach.name} stays quiet until you ask about the current move.`
                  : "Nothing is shown during the game. The full review opens when it ends."}
            </p>
          </div>
          <div className="button-row">
            <Button variant="primary" onClick={start} disabled={starting}>
              {starting ? "Starting…" : `Play ${coach.name}`}
            </Button>
          </div>
        </section>
        <div className="play-setup-coach">
          <CoachAvatar reaction={{ key: "play-setup", state: "neutral" }} />
        </div>
      </div>
      {!profile && !error && <LoadingState>Loading…</LoadingState>}
    </>
  );
}
