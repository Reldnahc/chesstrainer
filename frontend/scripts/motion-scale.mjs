// Rejects raw interface motion: every transition and animation must time itself
// with the --motion-* durations and --ease-* curves in src/foundation.css, never
// transition `all`, and leave reduced motion to the global policy in
// src/interface-motion.css. Coach portraits keep their own hand-tuned timing and
// are not checked. See docs/UI_COMPONENTS.md#motion.
import { readFileSync } from "node:fs";
import { sourceFiles } from "./source-files.mjs";

// Coach portrait artwork, rigs and speech. The coach picker and studio chrome are interface.
const COACH = /^src\/coach\/(?!settings\.css$|studio\/)/;
// The global Still/device policy, and the loading board's resting frame under it.
const REDUCED_MOTION_OWNERS = new Set(["src/interface-motion.css", "src/load-state.css"]);

const DECLARATION = /(?:^|[{;])\s*((?:transition|animation)(?:-[\w-]+)?)\s*:\s*([^;}]*)/g;
const RAW_TIME = /(?<![\w-])(\d*\.?\d+)(ms|s)\b/g;
const RAW_EASING =
  /(?<![\w-])(ease(?:-in-out|-in|-out)?|linear|step-start|step-end|steps\(|cubic-bezier\(|linear\()(?![\w-])/g;

export function violations(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, " "));
  const lineOf = index => text.slice(0, index).split("\n").length;
  const found = [];
  for (const match of text.matchAll(DECLARATION)) {
    const [, property, raw] = match;
    const value = raw.replace(/\s+/g, " ").trim();
    const line = lineOf(match.index + match[0].indexOf(property));
    const report = reason => found.push({ line, property, value, reason });
    if (property === "animation-name") continue;
    if ([...value.matchAll(RAW_TIME)].some(([, number]) => Number(number) !== 0))
      report("use a --motion-* duration");
    if (RAW_EASING.test(value)) report("use an --ease-* curve");
    RAW_EASING.lastIndex = 0;
    if (/^transition(-property)?$/.test(property) && /(?:^|,)\s*all\b/.test(value)) {
      report("name the properties that change instead of all");
    }
  }
  return found;
}

export function reducedMotionQueries(css) {
  return [...css.matchAll(/prefers-reduced-motion/g)].map(
    match => css.slice(0, match.index).split("\n").length,
  );
}

const files = sourceFiles(/\.css$/).filter(file => !COACH.test(file));
let count = 0;
for (const file of files) {
  const css = readFileSync(file, "utf8");
  for (const { line, property, value, reason } of violations(css)) {
    console.error(`${file}:${line}: ${property}: ${value} — ${reason}`);
    count++;
  }
  if (!REDUCED_MOTION_OWNERS.has(file)) {
    for (const line of reducedMotionQueries(css)) {
      console.error(
        `${file}:${line}: prefers-reduced-motion — src/interface-motion.css already applies it`,
      );
      count++;
    }
  }
}
if (count) {
  console.error(`\n${count} motion problem(s). Use the motion scale in src/foundation.css.`);
  process.exit(1);
}
console.log(`Motion scale: ${files.length} interface stylesheets use only --motion-* timing.`);
