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

/** One alternative chain ("variant|generic") with each id's colour line first and
 * its takes rotated by the seed, so a game spreads its plies across the wordings. */
export function withColourAndTakes(chain: string, side: Side | null | undefined, seed: readonly unknown[]): string {
  const ids = chain.split(ALTERNATIVE_SEPARATOR).flatMap(id => {
    const coloured = side ? colours.get(id)?.get(side) : undefined;
    const pool = [id, ...(takes.get(id) ?? []).filter(take => !take.side || take.side === side).map(take => take.id)];
    const start = pool.length > 1 ? Number.parseInt(stableKey([...seed, id]), 16) % pool.length : 0;
    return [...coloured ? [coloured] : [], ...pool.slice(start), ...pool.slice(0, start)];
  });
  return [...new Set(ids)].join(ALTERNATIVE_SEPARATOR);
}

/** Applies colour lines and takes to each sentence of a sequence. */
export function withColoursAndTakes(id: string, sides: ReadonlyMap<string, Side>, seed: readonly unknown[]): string {
  return id.split(SEQUENCE_SEPARATOR).map(part =>
    withColourAndTakes(part, sides.get(part.split(ALTERNATIVE_SEPARATOR).at(-1)!), seed)).join(SEQUENCE_SEPARATOR);
}
