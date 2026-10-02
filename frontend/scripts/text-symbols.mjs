// Fails when interface source contains characters a browser or phone may draw as
// emoji: pictographs, variation selectors, and the arrow/dingbat/shape blocks
// (✓ ↗ ★ ▶ ♟ …). Draw these with lucide icons instead; see docs/UI_COMPONENTS.md.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const frontend = join(dirname(fileURLToPath(import.meta.url)), "..");
const roots = ["src", "coach-studio", "audio-studio", "intelligence-lab", "index.html"];
const sources = /\.(tsx?|mts|mjs|jsx?|css|html|json)$/;
const skipped = /\.provenance\.json$|[\\/]mouth[\\/]/;

const pictograph = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|[︎️]/u;
const symbolBlocks = /[←-⇿⌀-⏿①-⓿■-◿☀-➿⤀-⥿⬀-⯿]/u;
const escaped = /\\u\{?(?:2[1-9b][0-9a-f]{2}|1f[0-9a-f]{3}|fe0[ef])\}?/i;

function files(path) {
  let entries;
  try { entries = readdirSync(path, { withFileTypes: true }); } catch { return sources.test(path) ? [path] : []; }
  return entries.flatMap(entry => entry.name === "node_modules" ? [] : files(join(path, entry.name)));
}

export function findTextSymbols() {
  const found = [];
  for (const file of roots.flatMap(root => files(join(frontend, root)))) {
    if (!sources.test(file) || skipped.test(file)) continue;
    readFileSync(file, "utf8").split(/\r?\n/).forEach((line, index) => {
      for (const ch of line) {
        if (pictograph.test(ch) || symbolBlocks.test(ch)) {
          found.push(`${relative(frontend, file)}:${index + 1} U+${ch.codePointAt(0).toString(16).toUpperCase()} ${ch}`);
        }
      }
      const escape = line.match(escaped);
      if (escape) found.push(`${relative(frontend, file)}:${index + 1} escape ${escape[0]}`);
    });
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const found = findTextSymbols();
  if (found.length) {
    console.error(`Characters that can render as emoji; use a lucide icon instead:\n${found.join("\n")}`);
    process.exit(1);
  }
  console.log("No emoji-capable symbols in interface source.");
}
