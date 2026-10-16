// Rejects a colour typed again where a shared one already names it: a stylesheet
// colour equal to a token in src/foundation.css uses var(--token), and a script
// colour equal to one of boardCues.ts's ARROW_COLOURS uses that name. One-off
// artwork and component tints may stay literal (docs/UI_COMPONENTS.md#colour).
// Coach portrait artwork is not checked; its palettes are hand-drawn.
import { readFileSync } from "node:fs";
import { sourceFiles } from "./source-files.mjs";

const COACH_ARTWORK = /^src\/coach\/(?!settings\.css$|studio\/)/;
const TOKENS_FILE = "src/foundation.css";
const ARROWS_FILE = "src/boardCues.ts";
const HEX = /#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{3,4})\b/gi;

/** A hex colour in one spelling: lowercase, six or eight digits, no opaque alpha. */
export function normalise(hex) {
  let digits = hex.slice(1).toLowerCase();
  if (digits.length <= 4) digits = [...digits].map(digit => digit + digit).join("");
  if (digits.length === 8 && digits.endsWith("ff")) digits = digits.slice(0, 6);
  return `#${digits}`;
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const blankComments = text =>
  text.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, " "));

/** Each literal colour token's value -> its name, from the first definition. */
export function tokenColours(css) {
  const tokens = new Map();
  for (const [, name, value] of blankComments(css).matchAll(
    /(--[\w-]+)\s*:\s*(#[\da-f]{3,8})\s*;/gi,
  )) {
    const colour = normalise(value);
    if (!tokens.has(colour)) tokens.set(colour, name);
  }
  return tokens;
}

/** Each arrow colour's value -> its ARROW_COLOURS name. */
export function arrowColours(source) {
  const block = source.match(/export const ARROW_COLOURS = \{([\s\S]*?)\}/)?.[1] ?? "";
  return new Map(
    [...block.matchAll(/(\w+):\s*"(#[\da-f]{3,8})"/gi)].map(([, name, value]) => [
      normalise(value),
      name,
    ]),
  );
}

/** Colours in `text` that copy a shared one, as { line, colour, use }. */
export function copies(text, shared, describe) {
  return [...text.matchAll(HEX)]
    .filter(match => shared.has(normalise(match[0])))
    .map(match => ({
      line: lineOf(text, match.index),
      colour: match[0],
      use: describe(shared.get(normalise(match[0]))),
    }));
}

const tokens = tokenColours(readFileSync(TOKENS_FILE, "utf8"));
const arrows = arrowColours(readFileSync(ARROWS_FILE, "utf8"));
let count = 0;
const report = (file, found) => {
  for (const { line, colour, use } of found) {
    console.error(`${file}:${line}: ${colour} — use ${use}`);
    count++;
  }
};
for (const file of sourceFiles(/^src\/.*\.css$/)) {
  if (file === TOKENS_FILE || COACH_ARTWORK.test(file)) continue;
  report(
    file,
    copies(blankComments(readFileSync(file, "utf8")), tokens, name => `var(${name})`),
  );
}
for (const file of sourceFiles(/^src\/.*\.tsx?$/)) {
  if (file === ARROWS_FILE || COACH_ARTWORK.test(file)) continue;
  report(
    file,
    copies(readFileSync(file, "utf8"), arrows, name => `ARROW_COLOURS.${name}`),
  );
}
if (count) {
  console.error(
    `${count} colour${count === 1 ? "" : "s"} copy a shared colour. See docs/UI_COMPONENTS.md#colour.`,
  );
  process.exit(1);
}
console.log(`Colours: no stylesheet or script re-types a shared token or arrow colour.`);
