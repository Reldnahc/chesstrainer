import {neutralTemplates} from "./templates";
import {stableKey, type CoachUtterance, type DialogueIntent} from "./model";
import {neutralPersonality, type DialogueCharacter, type PersonalityInput} from "./personality";
import {alternativeTemplate} from "./positionalTemplates";

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
    const alternative = item.position?.line === "alternative";
    const fallback = alternative ? alternativeTemplate(item) : neutralTemplates[item.code];
    const fallbackSource = alternative ? "positional-conditional-1" : "neutral-1";
    // Personal praise/correction belongs to the learner. Opponent facts retain
    // objective wording even if a personality template addresses the player.
    const custom = alternative || intent.subject !== "learner" ? undefined : personality.templates[item.code];
    let options = custom?.length ? custom : fallback;
    if (!options?.length) continue;
    let index = Number.parseInt(stableKey([intent.id, item.code, ...(custom?.length ? [character.id, personality.version] : [])]), 16) % options.length;
    let text = expand(options[index], item.slots);
    let source = custom?.length ? personality.version : fallbackSource;
    if (!text && custom?.length && fallback?.length) {
      options = fallback;
      index = Number.parseInt(stableKey([intent.id, item.code]), 16) % options.length;
      text = expand(options[index], item.slots);
      source = fallbackSource;
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
