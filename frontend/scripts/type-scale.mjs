// Rejects raw text sizes: every font-size (and the size in a font shorthand) must
// use the --text-* scale or a text role from src/foundation.css. Relative sizes
// (em, %, container units) and keywords stay allowed for sizes that follow their
// container. See docs/UI_COMPONENTS.md#type.
import { readFileSync } from "node:fs";
import { sourceFiles } from "./source-files.mjs";

const PROPERTY = /(?:^|[{;\s])(font-size|font|--[\w-]*font-size[\w-]*)\s*:\s*([^;}]*)/g;
const RAW = /(^|[\s(,/])(\d*\.?\d+)(px|rem|pt)\b/g;

// Whole declarations are read, so a value wrapped over several lines is checked too.
export function violations(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, " "));
  const lineOf = index => text.slice(0, index).split("\n").length;
  const found = [];
  for (const match of text.matchAll(PROPERTY)) {
    const [, property, value] = match;
    // In a shorthand only the size before any "/line-height" counts; px line heights are not sizes.
    const size = property === "font" ? value.split("/")[0] : value;
    for (const [, , number, unit] of size.matchAll(RAW)) {
      found.push({ line: lineOf(match.index + match[0].indexOf(property)), property, value: value.replace(/\s+/g, " ").trim(), raw: `${number}${unit}` });
    }
  }
  return found;
}

const files = sourceFiles(/\.css$/);
let count = 0;
for (const file of files) {
  for (const { line, property, value } of violations(readFileSync(file, "utf8"))) {
    console.error(`${file}:${line}: ${property}: ${value} — use a --text-* token or text role`);
    count++;
  }
}
if (count) {
  console.error(`\n${count} raw text size(s). Use the type scale in src/foundation.css.`);
  process.exit(1);
}
console.log(`Type scale: ${files.length} stylesheets use only --text-* sizes.`);
