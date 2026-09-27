import {neutralTemplates} from "./templates";
import {stableKey, type CoachUtterance, type DialogueIntent} from "./model";
import {neutralPersonality, type DialogueCharacter, type PersonalityInput} from "./personality";

function expand(template: string, slots: Record<string, string | number>) {
  // Motif vocabulary is controlled, but its first sound changes the article.
  const phrasing = typeof slots.motif === "string" && /^[aeiou]/i.test(slots.motif)
    ? template.replaceAll("a {motif}", "an {motif}") : template;
  const text = phrasing.replace(/\{(\w+)\}/g, (_, key: string) => String(slots[key] ?? `{${key}}`))
    .replace(/\s+/g, " ").replace(/\s+([,:;.?!])/g, "$1").trim();
  return /\{\w+\}/.test(text) ? "" : text;
}

export function renderNeutral(intent: DialogueIntent): CoachUtterance {
  return renderDialogue(intent, {id: "neutral"});
}

export function renderDialogue(intent: PersonalityInput, character: DialogueCharacter): CoachUtterance {
  const personality = character.personality ?? neutralPersonality;
  const variants: CoachUtterance["trace"]["variants"] = [];
  const sentences: string[] = [];
  for (const item of [...intent.claims].sort((a, b) => b.priority - a.priority)) {
    const custom = personality.templates[item.code];
    let options = custom?.length ? custom : neutralTemplates[item.code];
    if (!options?.length) continue;
    let index = Number.parseInt(stableKey([intent.id, item.code, ...(custom?.length ? [character.id, personality.version] : [])]), 16) % options.length;
    let text = expand(options[index], item.slots);
    let source = custom?.length ? personality.version : "neutral-1";
    if (!text && custom?.length && neutralTemplates[item.code]?.length) {
      options = neutralTemplates[item.code];
      index = Number.parseInt(stableKey([intent.id, item.code]), 16) % options.length;
      text = expand(options[index], item.slots);
      source = "neutral-1";
    }
    if (!text || sentences.includes(text)) continue;
    // Keep whole factual sentences. A secondary fact never pushes the bubble into an essay.
    if (sentences.length && (sentences.join(" ").length + text.length > personality.maxCharacters || sentences.length >= personality.maxClaims)) continue;
    sentences.push(text);
    variants.push({code: item.code, index, sourceIds: item.sourceIds, source});
  }
  const text = sentences.join(" ") || "The current evidence does not support a more specific explanation.";
  return {version: "coach-utterance-1", id: `cu1:${stableKey([intent.id, character.id, personality.version, text])}`,
    intentId: intent.id, coachId: character.id, text, expression: intent.expression,
    intensity: intent.intensity, priority: intent.priority, interruptible: intent.interruptible,
    autoSpeakSuitable: intent.autoSpeakSuitable,
    delivery: personality.delivery,
    trace: {renderer: personality.version, variants, decisions: intent.decisions}};
}
