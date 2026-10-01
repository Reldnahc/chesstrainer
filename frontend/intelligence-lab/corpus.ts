import {selectableCoaches} from "../src/coach/registry";
import {dialoguePurposes, stableKey} from "../src/dialogue/model";
import {neutralTemplates} from "../src/dialogue/templates";
import {renderDialogue} from "../src/dialogue/neutral";
import {factualParts, validWording, wordingParts} from "../src/dialogue/composition";
import {writingExamples, exampleIntent} from "./examples";
import {tacticalTemplate} from "../src/dialogue/tacticalTemplates";

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9{}]+/g, " ").trim();
export const commonClaims = ["allowed_mate", "tactic_played", "tactic_allowed", "tactic_missed",
  "cause_abandoned_defender", "cause_opponent_threat_recognition", "cause_avoiding_bad_trades",
  "sacrifice", "only_move", "best", "good", "loss", "recovery", "retry", "explanation", "development",
  "human_natural_error", "human_challenging", "human_defense_found", "mate_win", "mate_loss", "recovered", "accepted", "cold", "thinking", "unavailable"];

export function auditCorpus() {
  const errors: string[] = [], warnings: string[] = [];
  const fingerprints = new Map<string, string>();
  const behaviorSignatures = new Set<string>();
  let templates = 0;
  const coverage: {id: string; name: string; samples: number; customClaims: number; fallbackClaims: number; composedClaims: number}[] = [];
  for (const purpose of dialoguePurposes) if (!writingExamples.some(e => e.purpose === purpose)) errors.push(`No writing exercise: ${purpose}`);
  for (const coach of selectableCoaches) {
    const definition = coach.personality;
    if (definition.version === "neutral-1") errors.push(`${coach.name}: no character definition`);
    if (!definition.behavior) errors.push(`${coach.name}: no communication behavior`);
    else {
      const signature = normalize(definition.behavior.signature);
      if (signature.length < 20 || behaviorSignatures.has(signature)) errors.push(`${coach.name}: missing or duplicate behavioral signature`);
      behaviorSignatures.add(signature);
    }
    for (const [field, text] of Object.entries(definition.bible)) if (text.length < 20) errors.push(`${coach.name}: incomplete ${field}`);
    for (const code of commonClaims) if (!definition.templates[code]?.length) errors.push(`${coach.name}: no character handling for ${code}`);
    for (const [code, options] of Object.entries(definition.templates)) {
      const reference = code === "tactic_witness" && definition.tacticalWording === "witness"
        ? tacticalTemplate : neutralTemplates[code];
      if (!reference) {errors.push(`${coach.name}: unknown claim ${code}`); continue;}
      const seen = new Set<string>();
      for (const wording of options ?? []) {
        templates++;
        const key = normalize(wordingParts(wording).join(" "));
        if (!validWording(wording, reference)) errors.push(`${coach.name}/${code}: factual slot mismatch`);
        if (factualParts(wording).join(" ").length > 330) errors.push(`${coach.name}/${code}: oversized factual template`);
        if (seen.has(key)) errors.push(`${coach.name}/${code}: repeated exact variant`);
        seen.add(key);
      }
    }
    const row = {id: coach.id, name: coach.name, samples: 0, customClaims: 0, fallbackClaims: 0, composedClaims: 0};
    const corpus: string[] = [];
    for (let index = 0; index < writingExamples.length; index++) for (let take = 0; take < 12; take++) {
      const intent = exampleIntent(index, take), output = renderDialogue(intent, coach);
      row.samples++;
      row.customClaims += output.trace.composition?.characterClaims ?? 0;
      row.fallbackClaims += output.trace.composition?.fallbackClaims ?? 0;
      row.composedClaims += output.trace.variants.filter(v => v.form === "composed").length;
      corpus.push(normalize(output.text));
      if (output.text.includes("{") || output.text.length > 330) errors.push(`${coach.name}/${intent.purpose}: rendered length/placeholder problem`);
      if (output.trace.variants[0]?.source !== definition.version) errors.push(`${coach.name}/${intent.purpose}: common primary claim fell back to neutral`);
      if (output.expression !== intent.expression || output.priority !== intent.priority || output.intentId !== intent.id) errors.push(`${coach.name}/${intent.purpose}: changed semantic delivery`);
    }
    if (!row.composedClaims) errors.push(`${coach.name}: no composed responses`);
    const fingerprint = stableKey(corpus), duplicate = fingerprints.get(fingerprint);
    // Two coaches can share a terse true fact. A whole voice must not collapse
    // into another coach across the complete, identical writing exercise set.
    if (duplicate) warnings.push(`Indistinguishable corpus: ${duplicate} / ${coach.name}`);
    fingerprints.set(fingerprint, coach.name);
    coverage.push(row);
  }
  return {coaches: selectableCoaches.length, templates, coverage, errors: [...new Set(errors)], warnings: [...new Set(warnings)]};
}
