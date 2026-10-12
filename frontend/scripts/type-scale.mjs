// Rejects raw text sizes: every font-size (and the size in a font shorthand) must
// use the --text-* scale or a text role from src/foundation.css. Relative sizes
// (em, %, container units) and keywords stay allowed for sizes that follow their
// container. See docs/UI_COMPONENTS.md#type.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PROPERTY = /(?:^|[{;\s])(font-size|font|--[\w-]*font-size[\w-]*)\s*:\s*([^;}]*)/g;
const RAW = /(^|[\s(,/])(\d*\.?\d+)(px|rem|pt)\b/g;

export function violations(css) {
  const found = [];
  css.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, " ")).split("\n").forEach((line, index) => {
    for (const [, property, value] of line.matchAll(PROPERTY)) {
      // In a shorthand only the size before any "/line-height" counts; px line heights are not sizes.
      const size = property === "font" ? value.split("/")[0] : value;
      for (const [, , number, unit] of size.matchAll(RAW)) {
        found.push({ line: index + 1, property, value: value.trim(), raw: `${number}${unit}` });
      }
    }
  });
  return found;
}

const files = execFileSync("git", ["ls-files", "*.css"], { encoding: "utf8" }).split("\n").filter(Boolean);
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
