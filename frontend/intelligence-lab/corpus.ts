import {selectableCoaches} from "../src/coach/registry";
import {dialoguePurposes} from "../src/dialogue/model";
import {neutralTemplates} from "../src/dialogue/templates";
import {renderDialogue} from "../src/dialogue/neutral";
import {writingExamples, exampleIntent} from "./examples";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]);
const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9{}]+/g, " ").trim();
const highFrequency = ["allowed_mate", "tactic_played", "tactic_allowed", "tactic_missed", "sacrifice", "only_move", "best", "good", "loss", "recovery", "retry", "explanation"];

export function auditCorpus() {
  const errors: string[] = [], warnings: string[] = [];
  const lines = new Map<string, string[]>();
  const groups = new Map<string, {owner: string; tokens: Set<string>}[]>();
  let templates = 0;
  for (const purpose of dialoguePurposes) if (!writingExamples.some(e => e.purpose === purpose)) errors.push(`No writing exercise: ${purpose}`);
  for (const coach of selectableCoaches) {
    const definition = coach.personality;
    if (definition.version === "neutral-1") errors.push(`${coach.name}: no character definition`);
    for (const [field, text] of Object.entries(definition.bible)) if (text.length < 20) errors.push(`${coach.name}: incomplete ${field}`);
    for (const code of highFrequency) if ((definition.templates[code]?.length ?? 0) < 2) errors.push(`${coach.name}: needs variation for ${code}`);
    const seen = new Set<string>();
    for (const [code, options] of Object.entries(definition.templates)) {
      if (!neutralTemplates[code]) {errors.push(`${coach.name}: unknown claim ${code}`); continue;}
      const reference = neutralTemplates[code].map(placeholders);
      const allowed = new Set(reference.flat());
      const required = reference[0].filter(slot => reference.every(slots => slots.includes(slot)));
      for (const text of options ?? []) {
        templates++;
        const slots = placeholders(text), key = normalize(text);
        if (slots.some(slot => !allowed.has(slot)) || required.some(slot => !slots.includes(slot))) errors.push(`${coach.name}/${code}: factual slot mismatch`);
        if (text.length > 255) errors.push(`${coach.name}/${code}: oversized template`);
        if (seen.has(key)) errors.push(`${coach.name}/${code}: repeated exact line`);
        seen.add(key);
        if (key.split(" ").length >= 8) lines.set(key, [...(lines.get(key) ?? []), `${coach.name}/${code}`]);
        const tokens = new Set(key.split(" "));
        if (tokens.size >= 10) groups.set(code, [...(groups.get(code) ?? []), {owner: coach.name, tokens}]);
      }
    }
    for (let index = 0; index < writingExamples.length; index++) for (let take = 0; take < 12; take++) {
      const intent = exampleIntent(index, take), output = renderDialogue(intent, coach);
      if (output.text.includes("{") || output.text.length > 330) errors.push(`${coach.name}/${intent.purpose}: rendered length/placeholder problem`);
      if (!output.trace.variants.some(v => v.source === definition.version)) errors.push(`${coach.name}/${intent.purpose}: no distinctive primary wording`);
      if (output.expression !== intent.expression || output.priority !== intent.priority) errors.push(`${coach.name}/${intent.purpose}: changed semantic delivery`);
    }
  }
  for (const owners of lines.values()) if (owners.length > 1) warnings.push(`Shared long sentence: ${owners.join(", ")}`);
  for (const [code, group] of groups) for (let i = 0; i < group.length; i++) for (const right of group.slice(i + 1)) {
    const left = group[i];
    if (left.owner === right.owner) continue;
    const union = new Set([...left.tokens, ...right.tokens]).size;
    const overlap = [...left.tokens].filter(token => right.tokens.has(token)).length;
    if (overlap / union > .9) warnings.push(`Near-identical ${code}: ${left.owner} / ${right.owner}`);
  }
  return {coaches: selectableCoaches.length, templates, errors: [...new Set(errors)], warnings: [...new Set(warnings)]};
}
