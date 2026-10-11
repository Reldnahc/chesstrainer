// Rejects raw spacing values: every margin, padding and gap must use the
// --space-* scale in src/foundation.css (or a semantic token built from it).
// 0 and 1px (border compensation) are allowed; so are %, auto and em/rem.
// See docs/UI_COMPONENTS.md#spacing.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PROPERTY = /(?:^|[{;\s])((?:margin|padding)(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?|gap|row-gap|column-gap|--[\w-]*(?:padding|margin|gap)[\w-]*)\s*:\s*([^;}]*)/g;
const RAW = /(^|[\s(,])-?(\d*\.?\d+)px\b/g;

export function violations(css) {
  const found = [];
  css.split("\n").forEach((line, index) => {
    for (const [, property, value] of line.matchAll(PROPERTY)) {
      for (const [, , number] of value.matchAll(RAW)) {
        if (Number(number) > 1) found.push({ line: index + 1, property, value: value.trim() });
      }
    }
  });
  return found;
}

const files = execFileSync("git", ["ls-files", "*.css"], { encoding: "utf8" }).split("\n").filter(Boolean);
let count = 0;
for (const file of files) {
  for (const { line, property, value } of violations(readFileSync(file, "utf8"))) {
    console.error(`${file}:${line}: ${property}: ${value} — use a --space-* token`);
    count++;
  }
}
if (count) {
  console.error(`\n${count} raw spacing value(s). Use the scale in src/foundation.css.`);
  process.exit(1);
}
console.log(`Spacing scale: ${files.length} stylesheets use only --space-* tokens.`);
