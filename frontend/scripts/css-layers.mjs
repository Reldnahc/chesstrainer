// Every stylesheet puts its rules in one of the cascade layers declared by
// src/layers.css, so the order in which modules import their sheets never decides
// which rule wins (docs/ARCHITECTURE.md, "Stylesheets"). Each sheet also opens with
// the same order statement: whichever sheet a page, tool or test fixture loads
// first then fixes the order. Outside a layer block a sheet may hold only @import
// statements; an unlayered rule would beat every layer.
import { readFileSync } from "node:fs";
import { sourceFiles } from "./source-files.mjs";

const ORDER = readFileSync(new URL("../src/layers.css", import.meta.url), "utf8").match(/@layer\s+([^;{]+);/);
const LAYERS = ORDER ? ORDER[1].split(",").map(name => name.trim()) : [];
const STATEMENT = `@layer ${LAYERS.join(", ")};`;
// The canonical order, and the application entry, which holds only imports.
const EXEMPT = new Set(["src/layers.css", "src/styles.css"]);

export function problems(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found = [];
  let index = 0, ordered = false, rules = false;
  while (index < text.length) {
    const rest = text.slice(index);
    const space = /^\s+/.exec(rest);
    if (space) { index += space[0].length; continue; }
    const statement = /^@(import|charset)\b[^;]*;/.exec(rest);
    if (statement) { index += statement[0].length; continue; }
    const order = /^@layer\s+[^;{]+;/.exec(rest);
    if (order) {
      if (order[0].replace(/\s+/g, " ") !== STATEMENT) found.push(`order "${order[0]}" differs from src/layers.css`);
      if (rules) found.push("the layer order must come before the first layer block");
      ordered = true;
      index += order[0].length;
      continue;
    }
    const block = /^@layer\s+([\w-]+)\s*\{/.exec(rest);
    if (!block) {
      found.push(`unlayered "${rest.slice(0, 40).replace(/\s+/g, " ")}"`);
      break;
    }
    if (!LAYERS.includes(block[1])) found.push(`unknown layer "${block[1]}"`);
    rules = true;
    let depth = 1, end = index + block[0].length;
    for (; end < text.length && depth; end++) {
      if (text[end] === "{") depth++;
      else if (text[end] === "}") depth--;
    }
    index = end;
  }
  if (rules && !ordered) found.push(`missing the order statement "${STATEMENT}"`);
  return found;
}

if (!LAYERS.length) {
  console.error("src/layers.css must declare the layer order with one @layer statement.");
  process.exit(1);
}
const files = sourceFiles(/\.css$/).filter(file => !EXEMPT.has(file));
const failures = files.flatMap(file => problems(readFileSync(file, "utf8")).map(problem => `${file}: ${problem}`));
if (failures.length) {
  console.error(`Stylesheets must open with "${STATEMENT}" and wrap their rules in those layers:`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`Cascade layers: ${files.length} stylesheets declare the layer order and keep their rules in it.`);
