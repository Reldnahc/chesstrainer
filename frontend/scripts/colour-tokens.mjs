// Rejects a colour typed again where a shared one already names it: a colour equal
// to a token in src/foundation.css uses var(--token), and a colour equal to one of
// boardCues.ts's ARROW_COLOURS uses that name. Stylesheets and scripts are both
// read, in any spelling (#hex of any length, %23 in data URIs, rgb()/rgba() with an
// opaque alpha). One-off artwork and component tints may stay literal
// (docs/UI_COMPONENTS.md#colour); coach portrait artwork, whose palettes are
// hand-drawn, is not checked.
import { readFileSync } from "node:fs";
import { sourceFiles } from "./source-files.mjs";

// The portrait artwork itself; the coach's interface, speech and motion sheets are checked.
const COACH_ARTWORK = /^src\/coach\/(?:classic|human|studies)\//;
const TOKENS_FILE = "src/foundation.css";
const ARROWS_FILE = "src/boardCues.ts";
const HEX = /(?:#|%23)(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{3,4})\b/gi;
const RGB = /rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:\s*[,/]\s*(1|1\.0+|100%))?\s*\)/gi;

/** A hex colour in one spelling: lowercase, six or eight digits, no opaque alpha. */
export function normalise(hex) {
  let digits = hex.replace(/^(?:#|%23)/, "").toLowerCase();
  if (digits.length <= 4) digits = [...digits].map(digit => digit + digit).join("");
  if (digits.length === 8 && digits.endsWith("ff")) digits = digits.slice(0, 6);
  return `#${digits}`;
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;
/** Comments, and `url(#id)` references (an SVG id, not a colour), kept as blank space. */
const blank = text =>
  // A script's // line comment counts too, but not the // inside a URL.
  text.replace(/\/\*[\s\S]*?\*\/|(?<![:"'`\w\\])\/\/[^\n]*|url\(\s*["']?#[^)]*\)/g, match =>
    match.replace(/[^\n]/g, " "),
  );

/** Each literal colour token's value -> its name, from the first definition. */
export function tokenColours(css) {
  const tokens = new Map();
  for (const [, name, value] of blank(css).matchAll(/(--[\w-]+)\s*:\s*(#[\da-f]{3,8})\s*;/gi)) {
    const colour = normalise(value);
    if (!tokens.has(colour)) tokens.set(colour, `var(${name})`);
  }
  return tokens;
}

/** Each arrow colour's value -> its ARROW_COLOURS name. */
export function arrowColours(source) {
  const block = source.match(/export const ARROW_COLOURS = \{([\s\S]*?)\}/)?.[1] ?? "";
  return new Map(
    [...block.matchAll(/(\w+):\s*"(#[\da-f]{3,8})"/gi)].map(([, name, value]) => [
      normalise(value),
      `ARROW_COLOURS.${name}`,
    ]),
  );
}

/** Every colour written in `text`, as { index, colour, value } in one spelling. */
export function colours(text) {
  const hex = [...text.matchAll(HEX)].map(match => ({
    index: match.index,
    colour: match[0],
    value: normalise(match[0]),
  }));
  const rgb = [...text.matchAll(RGB)].map(match => ({
    index: match.index,
    colour: match[0],
    value: `#${match
      .slice(1, 4)
      .map(part => Number(part).toString(16).padStart(2, "0"))
      .join("")}`,
  }));
  return [...hex, ...rgb].sort((a, b) => a.index - b.index);
}

/** Colours in `text` that copy a shared one, as { line, colour, use }. */
export function copies(text, shared) {
  return colours(text)
    .filter(found => shared.has(found.value))
    .map(found => ({
      line: lineOf(text, found.index),
      colour: found.colour,
      use: shared.get(found.value),
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
for (const file of sourceFiles(/^src\/.*\.(?:css|tsx?)$/)) {
  if (COACH_ARTWORK.test(file)) continue;
  const text = blank(readFileSync(file, "utf8"));
  // Any sheet or script may copy a token or an arrow colour; the owners define their own.
  const shared = new Map([
    ...(file === TOKENS_FILE ? [] : tokens),
    ...(file === ARROWS_FILE ? [] : arrows),
  ]);
  report(file, copies(text, shared));
}
if (count) {
  console.error(
    `${count} colour${count === 1 ? "" : "s"} copy a shared colour. See docs/UI_COMPONENTS.md#colour.`,
  );
  process.exit(1);
}
console.log("Colours: no stylesheet or script re-types a shared token or arrow colour.");
