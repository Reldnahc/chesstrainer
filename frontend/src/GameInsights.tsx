import { useEffect, useState, type ReactNode } from "react";
import { ChartColumn } from "lucide-react";
import { api, read, type Schema } from "./api";
import ChoiceGroup from "./ChoiceGroup";
import StatList from "./StatList";
import EmptyState from "./EmptyState";
import ActionLink from "./ActionLink";
import Button from "./Button";
import Link from "./Link";
import { LoadingState, UnavailableState } from "./LoadState";
import { gamesPath, pagePaths } from "./navigation";
import "./game-insights.css";

type Insights = Schema["Insights"];
type Speed = Insights["speed"];
type InsightGame = Schema["InsightGame"];

const speedLabels: Record<Speed, string> = {
  all: "All speeds", bullet: "Bullet", blitz: "Blitz", rapid: "Rapid", classical: "Classical", daily: "Daily",
};
const periods = [
  { value: 0, label: "All time" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
] as const;
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const parts = [
  { id: "night", label: "Night", hours: "00–06" },
  { id: "morning", label: "Morning", hours: "06–12" },
  { id: "afternoon", label: "Afternoon", hours: "12–18" },
  { id: "evening", label: "Evening", hours: "18–24" },
] as const;
const endingLabels: Record<string, string> = {
  checkmate: "Checkmate", resignation: "Resignation", time: "On time", abandoned: "Abandoned",
  agreement: "Agreement", repetition: "Repetition", stalemate: "Stalemate",
  insufficient_material: "Insufficient material", fifty_moves: "Fifty-move rule", other: "Other",
};
const shapeText: Record<Schema["Shape"]["shape"], [string, string]> = {
  wire_to_wire: ["Led throughout", "Went ahead and never fell behind"],
  back_and_forth: ["Back and forth", "The lead changed sides two or more times"],
  unsettled: ["Unsettled", "No clear lead, or a lead that faded without a swing"],
  slipped: ["Let slip", "Clearly winning, then not won"],
  comeback: ["Comeback", "Clearly lost, then saved"],
};
const phaseLabels = { opening: "Opening", middlegame: "Middlegame", endgame: "Endgame" } as const;
const endgameLabels = { rook: "Rook endings", queen: "Queen endings", minor: "Minor-piece endings", pawn: "Pawn endings" } as const;
const clockLabels = { over_half: "Over half left", quarter: "25–50% left", tenth: "10–25% left", under_tenth: "Under 10% left" } as const;

const percent = (part: number, whole: number) => whole ? Math.round(100 * part / whole) : 0;
const plural = (count: number, word: string, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;
const pawns = (cp: number | null | undefined) => cp == null ? "—" : `${(cp / 100).toFixed(1)}`;
const fixed = (value: number | null | undefined, digits = 0, suffix = "") => value == null ? "—" : `${value.toFixed(digits)}${suffix}`;
const recordText = ({ wins, draws, losses }: { wins: number; draws: number; losses: number }) => `${wins}W ${draws}D ${losses}L`;
const moveOf = (ply: number) => Math.ceil(ply / 2);

function gameHref(game: InsightGame) {
  const base = gamesPath(1, game.id);
  return game.ply ? `${base}?ply=${game.ply}` : base;
}

function shortDate(value: string | null) {
  if (!value || !/^\d{4}\.\d{2}\.\d{2}$/.test(value)) return null;
  const date = new Date(`${value.replaceAll(".", "-")}T12:00:00Z`);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) : null;
}

function Panel({ id, title, meta, wide, children }: {
  id: string; title: string; meta?: ReactNode; wide?: boolean; children: ReactNode;
}) {
  return <section className={`panel insight-panel${wide ? " insight-panel--wide" : ""}`} aria-labelledby={`insight-${id}`}>
    <div className="insight-heading">
      <h3 id={`insight-${id}`}>{title}</h3>
      {meta && <span className="insight-meta">{meta}</span>}
    </div>
    {children}
  </section>;
}

function Lead({ children }: { children: ReactNode }) {
  return <p className="insight-lead">{children}</p>;
}

function Bars({ label, rows, max, unit = "" }: {
  label: string;
  rows: { label: ReactNode; value: number | null; detail?: string; tone?: string }[];
  max?: number;
  unit?: string;
}) {
  const top = max ?? Math.max(1, ...rows.map(row => row.value ?? 0));
  return <ul className="insight-bars" aria-label={label}>
    {rows.map((row, index) => <li key={index} title={row.detail}>
      <span className="insight-bar-label">{row.label}</span>
      <span className="insight-bar-track" aria-hidden="true">
        {row.value != null && row.value > 0 && <span className={`insight-bar-fill${row.tone ? ` insight-bar-fill--${row.tone}` : ""}`}
          style={{ width: `${Math.max(2, 100 * row.value / top)}%` }} />}
      </span>
      <span className="insight-bar-value">{row.value == null ? "—" : `${row.value}${unit}`}{row.detail &&
        <span className="sr-only">, {row.detail}</span>}</span>
    </li>)}
  </ul>;
}

function Outcomes({ label, items }: { label: string; items: { label: string; count: number; tone: "win" | "draw" | "loss" }[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return <div className="insight-outcomes">
    <div className="insight-split" role="img" aria-label={`${label}: ${items.map(item => `${item.label} ${item.count}`).join(", ")}`}>
      {items.filter(item => item.count).map(item => <span key={item.label} className={`insight-split-${item.tone}`}
        style={{ flexGrow: item.count }} title={`${item.label}: ${item.count}`} />)}
    </div>
    <ul className="insight-legend">
      {items.map(item => <li key={item.label}><span className={`insight-swatch insight-split-${item.tone}`} aria-hidden="true" />
        {item.label} <strong>{item.count}</strong> <span className="muted">{percent(item.count, total)}%</span></li>)}
    </ul>
  </div>;
}

function GameLinks({ label, games, slip }: { label: string; games: InsightGame[]; slip?: boolean }) {
  if (!games.length) return null;
  return <div className="insight-games">
    <h4>{label}</h4>
    <ul>
      {games.map(game => <li key={game.id}>
        <Link href={gameHref(game)}>
          <span className={`history-outcome outcome-${game.result === "unfinished" ? "unknown" : game.result}`}>
            {{ win: "Won", draw: "Draw", loss: "Lost", unfinished: "—" }[game.result]}
          </span>
          <span className="insight-game-name">vs {game.opponent}{game.opponent_rating ? ` (${game.opponent_rating})` : ""}</span>
          <span className="small muted">{[shortDate(game.played_on), slip && game.ply ? `move ${moveOf(game.ply)}` : null].filter(Boolean).join(" · ")}</span>
        </Link>
      </li>)}
    </ul>
  </div>;
}

function Sparkline({ points }: { points: Schema["RatingPoint"][] }) {
  if (points.length < 2) return null;
  const values = points.map(point => point.rating);
  const low = Math.min(...values), high = Math.max(...values), span = Math.max(1, high - low);
  const path = values.map((value, index) =>
    `${index ? "L" : "M"}${(100 * index / (values.length - 1)).toFixed(2)},${(36 - 32 * (value - low) / span).toFixed(2)}`).join(" ");
  return <svg className="insight-sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
    <path d={path} vectorEffect="non-scaling-stroke" />
  </svg>;
}

function ShapeIcon({ shape }: { shape: Schema["Shape"]["shape"] }) {
  const paths = {
    wire_to_wire: "M2,20 C12,18 18,10 30,8 S50,4 62,3",
    back_and_forth: "M2,16 C10,6 16,6 22,16 S34,26 40,16 S52,6 62,10",
    unsettled: "M2,16 C10,14 16,18 24,15 S40,13 46,17 S58,16 62,15",
    slipped: "M2,16 C12,12 20,4 30,5 S44,14 50,22 S58,28 62,28",
    comeback: "M2,16 C12,20 20,28 30,27 S44,18 50,10 S58,5 62,4",
  };
  return <svg className="insight-shape-icon" viewBox="0 0 64 32" aria-hidden="true">
    <line x1="0" x2="64" y1="16" y2="16" />
    <path d={paths[shape]} />
  </svg>;
}

function headlines(data: Insights) {
  const lines: string[] = [];
  const { conversion, escapes } = data.momentum;
  if (conversion.winning_games)
    lines.push(`You won ${conversion.converted} of the ${plural(conversion.winning_games, "game")} where you were clearly winning (${percent(conversion.converted, conversion.winning_games)}%).`);
  const slip = [...data.momentum.slip_moves].sort((a, b) => b.games - a.games)[0];
  if (slip?.games >= 2) lines.push(`Winning positions most often slipped around moves ${slip.label}.`);
  if (escapes.lost_games)
    lines.push(`You saved ${escapes.won + escapes.drawn} of ${plural(escapes.lost_games, "clearly lost game")}.`);
  const phases = data.moves.by_phase.filter(phase => phase.moves >= 20 && phase.accuracy != null);
  if (phases.length >= 2) {
    const sorted = [...phases].sort((a, b) => a.accuracy! - b.accuracy!);
    lines.push(`Your lowest move accuracy is in the ${sorted[0].phase} (${sorted[0].accuracy!.toFixed(0)}%), your highest in the ${sorted[sorted.length - 1].phase} (${sorted[sorted.length - 1].accuracy!.toFixed(0)}%).`);
  }
  const { after_loss: lossRate, after_other: otherRate } = data.tilt;
  if (lossRate.games >= 3 && otherRate.games >= 3 && lossRate.blunders_per_100 != null && otherRate.blunders_per_100 != null)
    lines.push(`Straight after a loss you blunder ${lossRate.blunders_per_100.toFixed(1)} times per 100 moves, against ${otherRate.blunders_per_100.toFixed(1)} after a win or draw.`);
  const openings = data.openings.filter(opening => opening.games >= 4 && opening.score != null && opening.name !== "Unrecognized");
  if (openings.length >= 2) {
    const sorted = [...openings].sort((a, b) => b.score! - a.score!);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    lines.push(`Your best-scoring opening is the ${best.name} as ${best.color} (${best.score}%); your weakest is the ${worst.name} as ${worst.color} (${worst.score}%).`);
  }
  return lines.slice(0, 5);
}

function Rhythm({ data }: { data: Insights }) {
  const cells = new Map(data.rhythm.cells.map(cell => [`${cell.weekday}-${cell.part}`, cell]));
  const scored = data.rhythm.cells.filter(cell => cell.wins + cell.draws + cell.losses >= 3)
    .map(cell => ({ cell, score: (cell.wins + cell.draws / 2) / (cell.wins + cell.draws + cell.losses) }));
  const best = [...scored].sort((a, b) => b.score - a.score)[0];
  const worst = [...scored].sort((a, b) => a.score - b.score)[0];
  const name = (cell: Schema["RhythmCell"]) => `${weekdays[cell.weekday]} ${cell.part}s`;
  return <Panel id="rhythm" title="When you play" meta={plural(data.rhythm.dated_games, "dated game")}>
    {best && worst && best !== worst && <Lead>Best: <strong>{name(best.cell)}</strong>, {recordText(best.cell)}. Weakest: <strong>{name(worst.cell)}</strong>, {recordText(worst.cell)}.</Lead>}
    <div className="insight-heatmap" role="table" aria-label="Results by weekday and time of day">
      <div role="row" className="insight-heatmap-row">
        <span role="columnheader" />
        {weekdays.map(day => <span role="columnheader" key={day}>{day}</span>)}
      </div>
      {parts.map(part => <div role="row" className="insight-heatmap-row" key={part.id}>
        <span role="rowheader" title={part.hours}>{part.label}</span>
        {weekdays.map((day, weekday) => {
          const cell = cells.get(`${weekday}-${part.id}`);
          const games = cell ? cell.wins + cell.draws + cell.losses : 0;
          const score = cell && games ? (cell.wins + cell.draws / 2) / games : null;
          const label = cell ? `${day} ${part.label.toLowerCase()}: ${recordText(cell)}` : `${day} ${part.label.toLowerCase()}: no games`;
          return <span role="cell" key={day} title={label} aria-label={label}
            className={`insight-heat${score == null ? " insight-heat--empty" : score >= 0.6 ? " insight-heat--good" : score <= 0.4 ? " insight-heat--poor" : " insight-heat--even"}`}
            style={score == null ? undefined : { opacity: 0.45 + 0.55 * Math.min(1, games / 6) }}>
            {games || ""}
          </span>;
        })}
      </div>)}
    </div>
    <ul className="insight-heat-legend" aria-label="Cell colours">
      <li><span className="insight-heat--good" aria-hidden="true" />Scored 60%+</li>
      <li><span className="insight-heat--even" aria-hidden="true" />In between</li>
      <li><span className="insight-heat--poor" aria-hidden="true" />Scored 40% or less</li>
    </ul>
    <p className="small muted insight-note">Each number is games played in that slot, in your local time.</p>
  </Panel>;
}

function Endings({ data }: { data: Insights }) {
  return <Panel id="endings" title="How games end" meta={recordText(data)}>
    <div className="insight-subgrid">
      {(["win", "loss", "draw"] as const).map(outcome => data.endings[outcome].length > 0 && <div key={outcome}>
        <h4>{{ win: "Wins", loss: "Losses", draw: "Draws" }[outcome]}</h4>
        <Bars label={`Game endings, ${outcome}s`} rows={data.endings[outcome].map(ending => ({
          label: endingLabels[ending.termination] ?? ending.termination, value: ending.games,
        }))} />
      </div>)}
    </div>
  </Panel>;
}

function Records({ data }: { data: Insights }) {
  const { records } = data;
  return <Panel id="records" title="Records and ratings">
    <StatList items={[
      { label: "Longest winning run", value: records.longest_win_streak },
      { label: "Longest losing run", value: records.longest_loss_streak },
      { label: "Current winning run", value: records.current_win_streak },
    ]} />
    {records.best_win && <GameLinks label="Highest-rated win" games={[records.best_win]} />}
    {data.ratings.length > 0 && <div className="insight-ratings">
      {data.ratings.slice(0, 4).map(series => {
        const change = series.last - series.first;
        return <div className="insight-rating" key={`${series.site}-${series.speed}`}>
          <div>
            <strong>{series.speed[0].toUpperCase() + series.speed.slice(1)}</strong> <span className="small muted">{series.site} · {plural(series.games, "game")}</span>
          </div>
          <Sparkline points={series.points} />
          <div className="insight-rating-values">
            <span>{series.first} to {series.last}</span>
            <span className={change > 0 ? "insight-up" : change < 0 ? "insight-down" : "muted"}>{change > 0 ? "+" : ""}{change}</span>
          </div>
        </div>;
      })}
    </div>}
  </Panel>;
}

function Openings({ data }: { data: Insights }) {
  const rows = data.openings.filter(row => row.games >= 2).slice(0, 10);
  const rest = data.openings.length - rows.length;
  if (!rows.length) return null;
  return <Panel id="openings" title="Openings" meta="by games played" wide>
    <div className="insight-table-scroll">
      <table className="insight-table">
        <thead><tr><th scope="col">Opening</th><th scope="col">Side</th><th scope="col">Games</th><th scope="col" className="insight-col-record">Record</th><th scope="col">Score</th><th scope="col">Move accuracy</th></tr></thead>
        <tbody>
          {rows.map(row => <tr key={`${row.name}-${row.color}`}>
            <th scope="row">{row.name}</th>
            <td><span className={`insight-side insight-side--${row.color}`} aria-hidden="true" /><span className="insight-side-name">{row.color === "white" ? "White" : "Black"}</span></td>
            <td>{row.games}</td>
            <td className="insight-col-record">{recordText(row)}</td>
            <td>
              <span className="insight-score"><span className="insight-score-fill" style={{ width: `${row.score ?? 0}%` }} aria-hidden="true" /></span>
              {fixed(row.score, 0, "%")}
            </td>
            <td title={row.reviewed_games ? `${plural(row.reviewed_games, "reviewed game")}` : "No reviewed games"}>{fixed(row.accuracy, 0, "%")}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <p className="small muted insight-note">Openings are named from the bundled Lichess opening list. Score counts a draw as half a win; move accuracy comes from reviewed games only.{rest > 0 ? ` ${plural(rest, "opening")} with a single game are not shown.` : ""}</p>
  </Panel>;
}

function Theory({ data }: { data: Insights }) {
  const { theory } = data;
  if (!theory.reviewed_games) return null;
  return <Panel id="theory" title="Leaving the opening book" meta={`${theory.costly_exits}/${theory.exits} exits`}>
    <Lead>{theory.costly_exits
      ? <>In {plural(theory.costly_exits, "reviewed game")}, your first move out of book cost a pawn or more: on average <strong>{pawns(theory.average_cost_cp)} pawns</strong> around move {fixed(theory.average_exit_move, 0)}.</>
      : theory.exits ? <>None of your {plural(theory.exits, "move")} out of the opening book cost a pawn or more.</>
      : <>You did not leave the opening book yourself in a reviewed game.</>}</Lead>
    {theory.openings.length > 0 && <Bars label="Costliest openings to leave" unit=" p" rows={theory.openings.map(row => ({
      label: row.name, value: Number((row.cost_cp / 100).toFixed(1)), detail: plural(row.games, "game"),
    }))} />}
    <p className="small muted insight-note">Counts only exits on your own move; the opponent leaving book is not your cost.</p>
  </Panel>;
}

function Momentum({ data }: { data: Insights }) {
  const { conversion, escapes, slip_moves } = data.momentum;
  return <Panel id="momentum" title="Conversion and escapes" meta={plural(data.momentum.reviewed_games, "reviewed game")} wide>
    <div className="insight-subgrid">
      <div>
        <h4>When you were clearly winning</h4>
        {conversion.winning_games ? <Outcomes label="Clearly winning games" items={[
          { label: "Won", count: conversion.converted, tone: "win" },
          { label: "Drawn", count: conversion.drawn, tone: "draw" },
          { label: "Lost", count: conversion.lost, tone: "loss" },
        ]} /> : <p className="small muted">No clearly winning positions yet.</p>}
        <GameLinks label="Recent wins that slipped" games={conversion.slips} slip />
      </div>
      <div>
        <h4>Where the win slipped</h4>
        <Bars label="Move where a winning position was lost for good" rows={slip_moves.map(bucket => ({
          label: `Moves ${bucket.label}`, value: bucket.games,
        }))} />
        <p className="small muted insight-note">The move after which the evaluation never returned to +3 for you.</p>
      </div>
      <div>
        <h4>When you were clearly lost</h4>
        {escapes.lost_games ? <Outcomes label="Clearly lost games" items={[
          { label: "Saved as a win", count: escapes.won, tone: "win" },
          { label: "Saved as a draw", count: escapes.drawn, tone: "draw" },
          { label: "Lost", count: escapes.still_lost, tone: "loss" },
        ]} /> : <p className="small muted">No clearly lost positions yet.</p>}
        <GameLinks label="Recent saves" games={escapes.saves} />
      </div>
    </div>
    <p className="small muted insight-note">Clearly winning or lost means an engine evaluation of three pawns or more, or a forced mate, at any point.</p>
  </Panel>;
}

function Shapes({ data }: { data: Insights }) {
  const total = data.shapes.reduce((sum, shape) => sum + shape.games, 0);
  if (!total) return null;
  const common = [...data.shapes].sort((a, b) => b.games - a.games)[0];
  return <Panel id="shapes" title="Game shapes" meta={plural(total, "reviewed game")}>
    <Lead>Your most common shape is <strong>{shapeText[common.shape][0].toLowerCase()}</strong>: {common.games} of {total} games, {recordText(common)}.</Lead>
    <ul className="insight-shapes">
      {data.shapes.map(shape => <li key={shape.shape}>
        <ShapeIcon shape={shape.shape} />
        <div>
          <strong>{shapeText[shape.shape][0]}</strong>
          <span className="small muted">{shapeText[shape.shape][1]}</span>
        </div>
        <div className="insight-shape-count">
          <strong>{shape.games}</strong>
          <span className="small muted">{recordText(shape)}</span>
        </div>
        {shape.examples[0] && <Link className="insight-shape-link small" href={gameHref(shape.examples[0])}
          aria-label={`Latest ${shapeText[shape.shape][0].toLowerCase()} game, against ${shape.examples[0].opponent}`}>Latest</Link>}
      </li>)}
    </ul>
  </Panel>;
}

function MoveQuality({ data }: { data: Insights }) {
  const { by_move, by_phase } = data.moves;
  const scored = by_move.filter(bucket => bucket.moves >= 10 && bucket.accuracy != null);
  const dip = [...scored].sort((a, b) => a.accuracy! - b.accuracy!)[0];
  return <Panel id="accuracy" title="Accuracy through the game" meta={plural(data.moves.reviewed_games, "reviewed game")}>
    {dip && <Lead>Your play dips most around moves <strong>{dip.label}</strong>, at {dip.accuracy!.toFixed(0)}% average move accuracy.</Lead>}
    <h4>By move number</h4>
    <Bars label="Average move accuracy by move number" max={100} unit="%" rows={by_move.map(bucket => ({
      label: `Moves ${bucket.label}`, value: bucket.accuracy == null ? null : Math.round(bucket.accuracy), detail: plural(bucket.moves, "move"),
    }))} />
    <h4>By phase</h4>
    <div className="insight-table-scroll">
      <table className="insight-table insight-table--compact">
        <thead><tr><th scope="col">Phase</th><th scope="col">Moves</th><th scope="col">Accuracy</th><th scope="col">Blunders per 100</th></tr></thead>
        <tbody>{by_phase.map(phase => <tr key={phase.phase}>
          <th scope="row">{phaseLabels[phase.phase]}</th>
          <td>{phase.moves}</td>
          <td>{fixed(phase.accuracy, 0, "%")}</td>
          <td>{fixed(phase.blunders_per_100, 1)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="small muted insight-note">Move accuracy averages Lichess's per-move score, so it runs higher than a game's accuracy. The endgame starts at six or fewer pieces besides kings and pawns.</p>
  </Panel>;
}

function Tilt({ data }: { data: Insights }) {
  const { after_loss: loss, after_other: other, rematches_after_loss: rematches } = data.tilt;
  return <Panel id="tilt" title="After a loss">
    <StatList items={[
      { label: "Blunders per 100 moves after a loss", value: fixed(loss.blunders_per_100, 1) },
      { label: "After a win or draw", value: fixed(other.blunders_per_100, 1) },
      { label: "Rematches after a loss", value: rematches.games ? recordText(rematches) : "None" },
    ]} />
    <p className="small muted insight-note">Counts the next game when it started within 90 minutes ({loss.games} after a loss, {other.games} after a win or draw, reviewed games only). A rematch is that next game against the same opponent.</p>
  </Panel>;
}

function Clock({ data }: { data: Insights }) {
  const { clock } = data;
  return <Panel id="clock" title="Clock" meta={`clocks in ${clock.clocked_games}/${data.games} games`}>
    {clock.clocked_games ? <>
      <Lead>You were short of time in <strong>{clock.time_trouble_games} of {plural(clock.clocked_games, "clocked game")}</strong> ({percent(clock.time_trouble_games, clock.clocked_games)}%): 30 seconds or less, or a tenth of your starting time.</Lead>
      <StatList items={clock.think_seconds.map(bucket => ({ label: `Average think, moves ${bucket.label}`, value: fixed(bucket.seconds, 0, "s") }))} />
      <h4>Blunder rate by time left</h4>
      <Bars label="Share of your clocked moves that were blunders, by time left" unit="%" rows={clock.blunders_by_clock.map(band => ({
        label: clockLabels[band.band], value: band.blunder_rate, detail: plural(band.moves, "move"),
      }))} />
    </> : <p className="small muted">None of these games has clock annotations. Newly imported games keep the clock times their PGN records.</p>}
  </Panel>;
}

function Punishment({ data }: { data: Insights }) {
  const { punishment } = data;
  if (!punishment.opponent_errors && !punishment.own_errors) return null;
  return <Panel id="punishment" title="Mistakes and replies">
    <Lead>You punished <strong>{percent(punishment.punished, punishment.opponent_errors)}%</strong> of your opponents' mistakes, and <strong>{percent(punishment.unpunished, punishment.own_errors)}%</strong> of yours went unpunished.</Lead>
    <Bars label="Mistakes and replies" max={100} unit="%" rows={[
      { label: "Opponent mistakes you punished", value: percent(punishment.punished, punishment.opponent_errors), detail: `${punishment.punished} of ${punishment.opponent_errors}` },
      { label: "Your mistakes that went unpunished", value: percent(punishment.unpunished, punishment.own_errors), detail: `${punishment.unpunished} of ${punishment.own_errors}` },
    ]} />
    <p className="small muted insight-note">A mistake loses a pawn or more. It counts as punished when the very next move keeps at least half of what it gave away.</p>
  </Panel>;
}

function Endgames({ data }: { data: Insights }) {
  const reached = data.endgames.reduce((sum, row) => sum + row.games, 0);
  if (!reached) return null;
  return <Panel id="endgames" title="Endgames" meta={`${reached} reached`}>
    <Bars label="Endgames where you kept the result the position deserved" max={100} unit="%" rows={data.endgames.filter(row => row.games).map(row => ({
      label: <>{endgameLabels[row.kind]} <span className="muted">{row.held}/{row.games}</span></>,
      value: percent(row.held, row.games), detail: `held ${row.held} of ${row.games}`,
    }))} />
    <p className="small muted insight-note">Held means the final result was at least as good as the evaluation when the endgame began.</p>
  </Panel>;
}

export default function GameInsights() {
  const [speed, setSpeed] = useState<Speed>("all");
  const [days, setDays] = useState(0);
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    read(api.GET("/api/insights", {
      signal: controller.signal,
      params: { query: { speed, days: days || undefined, offset: -new Date().getTimezoneOffset() } },
    }))
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [speed, days, attempt]);

  if (error) return <UnavailableState presentation="panel" actions={<Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>Try again</Button>}>
    Couldn’t load your insights. Please try again.
  </UnavailableState>;
  if (!data) return <LoadingState presentation="panel">Reading your games…</LoadingState>;
  const speeds: Speed[] = ["all", ...data.speeds];
  const lines = headlines(data);
  const finished = data.wins + data.draws + data.losses;
  const reviewed = data.reviewed_games > 0;
  return <div className="insights">
    <div className="insight-toolbar">
      {speeds.length > 2 && <div className="insight-filter"><span id="insight-speed">Speed</span>
        <ChoiceGroup label="Speed" value={speed} onChange={setSpeed}
          options={speeds.map(value => ({ value, label: speedLabels[value] }))} /></div>}
      <div className="insight-filter"><span id="insight-period">Period</span>
        <ChoiceGroup label="Period" value={days} onChange={setDays} options={periods} /></div>
    </div>
    {!data.games ? <EmptyState title="No games in this selection." icon={<ChartColumn />} actions={
      <ActionLink href={pagePaths.Settings}>Import games in Settings</ActionLink>}>
      Insights read your saved games. Try a longer period or another speed.
    </EmptyState> : <>
      <section className="panel insight-summary" aria-labelledby="insight-summary">
        <h2 id="insight-summary" className="sr-only">At a glance</h2>
        <StatList prominence="featured" items={[
          { label: "Games", value: data.games },
          { label: "Score", value: `${percent(data.wins + data.draws / 2, finished)}%` },
          { label: "Record", value: recordText(data) },
          { label: "Reviewed", value: data.reviewed_games },
        ]} />
        {lines.length ? <ul className="insight-headlines">{lines.map(line => <li key={line}>{line}</li>)}</ul>
          : <p className="insight-headlines-empty">Review more games to see engine-based patterns here.</p>}
        {data.reviewed_games < data.games && <p className="small muted insight-note">
          Results, dates, ratings, clocks and openings use every game. Evaluation-based panels use the {data.reviewed_games} reviewed {data.reviewed_games === 1 ? "game" : "games"}; <Link href={gamesPath()}>review more games</Link> to sharpen them.
        </p>}
      </section>
      <InsightGroup id="results" title="Results">
        <div className="insight-columns">
          <Rhythm data={data} />
          <Records data={data} />
        </div>
        <Endings data={data} />
        <Openings data={data} />
      </InsightGroup>
      {reviewed && <InsightGroup id="positions" title="Winning and losing positions">
        <Momentum data={data} />
        <div className="insight-columns">
          <Shapes data={data} />
          <Punishment data={data} />
          <Endgames data={data} />
        </div>
      </InsightGroup>}
      <InsightGroup id="moves" title="Moves and time">
        <div className="insight-columns">
          {reviewed && <MoveQuality data={data} />}
          <Clock data={data} />
          {reviewed && <Tilt data={data} />}
          {reviewed && <Theory data={data} />}
        </div>
      </InsightGroup>
    </>}
  </div>;
}

function InsightGroup({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section className="insight-group" aria-labelledby={`insight-group-${id}`}>
    <h2 id={`insight-group-${id}`}>{title}</h2>
    {children}
  </section>;
}
