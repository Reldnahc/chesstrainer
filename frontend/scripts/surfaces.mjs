// Enforces the surface rules in docs/UI_COMPONENTS.md#surfaces: phones show flat
// sections, and a card must earn its surface.
// 1. Only the components listed in surfaces.json "cards" may opt a panel into a
//    card on phones with .panel--card.
// 2. Every application rule that draws a card-like surface (a full border with a
//    fill or rounded corners) must be listed in surfaces.json "surfaces" with its kind.
//    "section" surfaces must also be flattened: another rule in the same file
//    (normally the phone media query) must set border: 0 for that selector.
import { readFileSync } from "node:fs";
import { sourceFiles } from "./source-files.mjs";

const manifest = JSON.parse(readFileSync(new URL("./surfaces.json", import.meta.url), "utf8"));
const KINDS = new Set(["control", "swatch", "status", "overlay", "board", "navigation", "section"]);
const APPLICATION = file =>
  file.startsWith("src/") &&
  !/^src\/(coach\/(cast|idleSignatures|classic|studies|studio)|audio\/studio)\//.test(file);
const PHONE = /@media\s*\(max-width:\s*760px\)/;

export function rules(css) {
  // Flattens @layer and @media blocks into rules that remember their query.
  const found = [];
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const walk = (text, media) => {
    let start = 0;
    for (let index = 0; index < text.length; index++) {
      // A statement such as @import or the layer order ends at its semicolon.
      if (text[index] === ";") {
        start = index + 1;
        continue;
      }
      if (text[index] !== "{") continue;
      const head = text.slice(start, index).trim();
      let depth = 1,
        end = index + 1;
      for (; end < text.length && depth; end++) {
        if (text[end] === "{") depth++;
        else if (text[end] === "}") depth--;
      }
      const body = text.slice(index + 1, end - 1);
      if (head.startsWith("@media")) walk(body, head);
      else if (head.startsWith("@layer")) walk(body, media);
      else if (!head.startsWith("@"))
        found.push({ selector: head.replace(/\s+/g, " "), body, media });
      index = end - 1;
      start = end;
    }
  };
  walk(source, null);
  return found;
}

function declarations(body) {
  return new Map(
    body
      .split(";")
      .map(part => part.split(":"))
      .filter(([name, ...value]) => name && value.length)
      .map(([name, ...value]) => [name.trim(), value.join(":").trim()]),
  );
}

export function cardLike(body) {
  const values = declarations(body);
  const background = values.get("background") ?? values.get("background-color");
  const border = values.get("border");
  const radius = values.get("border-radius");
  const bordered = !!border && !/^(0|none)\b/.test(border);
  const filled = !!background && !/^(transparent|none|inherit)\b/.test(background);
  // A full border with either a fill or rounded corners reads as a card.
  return bordered && (filled || (!!radius && !/^0\b/.test(radius)));
}

const problems = [];
const listed = new Map(
  Object.entries(manifest.surfaces).flatMap(([file, entries]) =>
    Object.entries(entries).map(([selector, kind]) => [`${file} ${selector}`, kind]),
  ),
);
for (const [key, kind] of listed)
  if (!KINDS.has(kind)) problems.push(`surfaces.json: ${key} has unknown kind "${kind}"`);

const seen = new Set();
const files = sourceFiles(/\.css$/).filter(APPLICATION);
for (const file of files) {
  const all = rules(readFileSync(file, "utf8"));
  for (const current of all) {
    const { selector, body, media } = current;
    if (media && !PHONE.test(media) && /min-width/.test(media)) continue;
    if (!cardLike(body)) continue;
    const key = `${file} ${selector}`;
    seen.add(key);
    const kind = listed.get(key);
    if (!kind) {
      problems.push(
        `${file}: "${selector}" draws a card (a full border with a fill or rounded corners). Phones show flat sections; ` +
          `if this surface earns its card, add it to scripts/surfaces.json with its kind (see docs/UI_COMPONENTS.md#surfaces).`,
      );
    } else if (kind === "section") {
      const target = selector.split(",")[0].trim();
      const flattened = all.some(
        rule =>
          rule !== current &&
          rule.selector.includes(target) &&
          /^(0|none)\b/.test(declarations(rule.body).get("border") ?? ""),
      );
      if (!flattened)
        problems.push(
          `${file}: section surface "${selector}" is not flattened (border: 0) at phone width.`,
        );
    }
  }
}
for (const key of listed.keys())
  if (!seen.has(key)) problems.push(`surfaces.json: ${key} no longer draws a surface; remove it.`);

const sources = sourceFiles(/\.tsx$/, "src");
for (const file of sources) {
  if (readFileSync(file, "utf8").includes("panel--card") && !manifest.cards[file]) {
    problems.push(
      `${file}: uses .panel--card but is not listed in scripts/surfaces.json "cards". Phones show flat sections unless a card earns its surface.`,
    );
  }
}
for (const file of Object.keys(manifest.cards)) {
  if (!sources.includes(file) || !readFileSync(file, "utf8").includes("panel--card"))
    problems.push(`surfaces.json: ${file} no longer uses .panel--card; remove it.`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(
  `Surfaces: ${listed.size} listed surfaces and ${Object.keys(manifest.cards).length} phone cards follow the rules.`,
);
