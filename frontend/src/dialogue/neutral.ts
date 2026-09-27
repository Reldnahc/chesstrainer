import {neutralTemplates} from "./templates";
import {stableKey, type CoachUtterance, type DialogueIntent} from "./model";

export function renderNeutral(intent: DialogueIntent): CoachUtterance {
  const variants: CoachUtterance["trace"]["variants"] = [];
  const sentences: string[] = [];
  for (const item of [...intent.claims].sort((a, b) => b.priority - a.priority)) {
    const options = neutralTemplates[item.code];
    if (!options?.length) continue;
    const index = Number.parseInt(stableKey([intent.id, item.code]), 16) % options.length;
    const text = options[index].replace(/\{(\w+)\}/g, (_, key: string) => String(item.slots[key] ?? `{${key}}`)).replace(/\s+/g, " ").trim();
    if (!text || /\{\w+\}/.test(text) || sentences.includes(text)) continue;
    // Keep whole factual sentences. A secondary fact never pushes the bubble into an essay.
    if (sentences.length && (sentences.join(" ").length + text.length > 290 || sentences.length >= 2)) continue;
    sentences.push(text);
    variants.push({code: item.code, index, sourceIds: item.sourceIds});
  }
  const text = sentences.join(" ") || "The current evidence does not support a more specific explanation.";
  return {version: "coach-utterance-1", id: `cu1:${stableKey([intent.id, "neutral-1", text])}`,
    intentId: intent.id, coachId: "neutral", text, expression: intent.expression,
    intensity: intent.intensity, priority: intent.priority, interruptible: intent.interruptible,
    autoSpeakSuitable: intent.autoSpeakSuitable,
    trace: {renderer: "neutral-1", variants, decisions: intent.decisions}};
}
