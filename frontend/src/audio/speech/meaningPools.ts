import {stableKey} from "../../dialogue/model";
import catalogue from "./meanings.json" with {type: "json"};
import {ALTERNATIVE_SEPARATOR, SEQUENCE_SEPARATOR} from "./sequence";

export type Side = "white" | "black";
type Meaning = {id: string; colourOf?: string; takeOf?: string; side?: Side};

// A colour line names the side its meaning is about ("White's passed pawn") and
// plays ahead of the colourless line, which stays its fallback. A take is another
// wording of the same moment, optionally for one side only, that shares its turns
// with the line it belongs to. Both come from the catalogue, so a meaning gains
// them only when its lines are imported (scripts/coach_line_slots.py), and the
// voice bank skips any that a coach has not recorded yet.
const colours = new Map<string, Map<Side, string>>(), takes = new Map<string, Meaning[]>();
for (const meaning of catalogue.meanings as Meaning[]) {
  if (meaning.colourOf && meaning.side) {
    const set = colours.get(meaning.colourOf) ?? new Map<Side, string>();
    colours.set(meaning.colourOf, set.set(meaning.side, meaning.id));
  }
  if (meaning.takeOf) takes.set(meaning.takeOf, [...takes.get(meaning.takeOf) ?? [], meaning]);
}

/** Takes in a seeded order: each round is its own shuffle, and a round never opens
 * with a take from the end of the round before, so any two turns up to two apart
 * get different takes whenever a meaning has three or more (a side's back-to-back
 * moves are two turns apart). */
export function shuffledTakes(ids: readonly string[], seed: readonly unknown[], round: number): string[] {
  const order = [...ids];
  for (let index = order.length - 1; index > 0; index--) {
    const pick = Number.parseInt(stableKey([...seed, round, index]), 16) % (index + 1);
    [order[index], order[pick]] = [order[pick], order[index]];
  }
  if (round > 0 && order.length > 1) {
    const previous = shuffledTakes(ids, seed, round - 1);
    // The first take avoids the previous round's last two; the second avoids its last.
    for (let index = 0; index < 2; index++) {
      const recent = previous.slice(previous.length - 2 + index);
      const swap = order.findIndex((id, at) => at >= index && !recent.includes(id));
      if (swap > index) [order[index], order[swap]] = [order[swap], order[index]];
    }
  }
  return order;
}

/** A meaning's takes, the nth turn's take first and the rest as fallbacks. */
function takeOrder(id: string, side: Side | null | undefined, seed: readonly unknown[], turn: number): string[] {
  const pool = [id, ...(takes.get(id) ?? []).filter(take => !take.side || take.side === side).map(take => take.id)];
  if (pool.length < 2) return pool;
  const order = shuffledTakes(pool, [...seed, id], Math.floor(turn / pool.length));
  const start = turn % pool.length;
  return [...order.slice(start), ...order.slice(0, start)];
}

/** One alternative chain ("variant|generic") with each id's colour line first and
 * its takes in turn order. */
export function withColourAndTakes(chain: string, side: Side | null | undefined, seed: readonly unknown[], turn = 0): string {
  const ids = chain.split(ALTERNATIVE_SEPARATOR).flatMap(id => {
    const coloured = side ? colours.get(id)?.get(side) : undefined;
    return [...coloured ? [coloured] : [], ...takeOrder(id, side, seed, turn)];
  });
  return [...new Set(ids)].join(ALTERNATIVE_SEPARATOR);
}

/** Applies colour lines and takes to each sentence of a sequence. A game seeds
 * by game and walks by ply, so neighbouring plies never share a take. */
export function withColoursAndTakes(id: string, sides: ReadonlyMap<string, Side>, seed: readonly unknown[], turn = 0): string {
  return id.split(SEQUENCE_SEPARATOR).map(part =>
    withColourAndTakes(part, sides.get(part.split(ALTERNATIVE_SEPARATOR).at(-1)!), seed, turn)).join(SEQUENCE_SEPARATOR);
}

/** A practice clip's takes for its nth play in a session: every take plays once
 * before any repeats. */
export function withSessionTake(id: string | null, session: unknown, plays: number): string | null {
  return id && withColourAndTakes(id, null, ["session", session], plays);
}
