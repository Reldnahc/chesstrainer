import {neutralTemplates} from "./templates";
import {stableKey, type CoachUtterance, type DialogueIntent} from "./model";
import {neutralPersonality, type DialogueCharacter, type PersonalityInput} from "./personality";
import {alternativeTemplate} from "./positionalTemplates";
import {composeWording, responseStrategy, sentenceCount, validWording} from "./composition";
import type {ClaimWording} from "./personality";
import {tacticalPresentation} from "./tacticalTemplates";
import {neutralTacticalTemplates} from "./scopedTacticalWording";
import {bookRecordingId} from "./openingPresentation";

export const openingSequenceTemplate = ["This move is part of {opening}."] as const;

function expand(template: string, slots: Record<string, string | number | undefined>) {
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
  const renderedClaims: NonNullable<CoachUtterance["renderedClaims"]> = [];
  const sentences: string[] = [];
  const strategy = responseStrategy(intent, personality);
  const wordingKey = personality.tacticalWording === "witness" || personality.openingWording === "sequence"
    ? intent.id : intent.wordingKey ?? intent.id;
  for (const item of [...intent.claims].sort((a, b) => b.priority - a.priority)) {
    const presentation = personality.tacticalWording === "witness" ? tacticalPresentation(item) : null;
    const opening = personality.openingWording === "sequence" && item.opening && ["book", "book_sound"].includes(item.code)
      ? bookRecordingId(item.opening) : null;
    const slots = presentation?.slots ?? item.slots;
    const alternative = item.position?.line === "alternative";
    const fallback = presentation ? neutralTacticalTemplates[presentation.code] : opening ? openingSequenceTemplate
      : alternative ? alternativeTemplate(item) : neutralTemplates[item.code];
    const fallbackSource = presentation ? "tactical-scoped-2" : opening ? "opening-sequence-1"
      : alternative ? "positional-conditional-1" : "neutral-1";
    // Personal praise/correction belongs to the learner. Opponent facts retain
    // objective wording even if a personality template addresses the player.
    // The opted-in scoped templates are authored as actor-neutral facts. Other
    // opponent claims retain the existing protection against learner praise.
    const custom = alternative || intent.subject !== "learner" && !presentation && !opening ? undefined
      : personality.templates[presentation?.code ?? opening ?? item.code];
    let options: readonly ClaimWording[] | undefined = custom?.length ? custom : fallback;
    if (!options?.length) continue;
    const key = stableKey([wordingKey, item.code, character.id, personality.version]);
    let index = Number.parseInt(custom?.length ? key : stableKey([wordingKey, item.code]), 16) % options.length;
    let wording = options[index];
    // The introduction establishes that this tactic belongs to an unplayed
    // candidate. Its concrete effects must not precede that scope.
    let composition = composeWording(wording, strategy, personality, key, !!presentation || item.code === "tactic_missed");
    let text = custom?.length && (!fallback || !validWording(wording, fallback)) ? "" : expand(composition.template, slots);
    let source = custom?.length ? personality.version : fallbackSource;
    if (!text && custom?.length && fallback?.length) {
      options = fallback;
      index = Number.parseInt(stableKey([wordingKey, item.code]), 16) % options.length;
      wording = options[index];
      composition = composeWording(wording, "minimal", personality, key);
      text = expand(composition.template, slots);
      source = fallbackSource;
    }
    if (!text || sentences.includes(text)) continue;
    const separator = sentences.length ? 1 : 0;
    if (composition.cues.length && sentences.join(" ").length + separator + text.length > personality.maxCharacters) {
      // Trim optional staging, never a square, reply, qualification or consequence.
      text = expand(composition.factual, slots);
      composition.cues = [];
    }
    // Keep whole factual sentences. A secondary fact never pushes the bubble into an essay.
    if (sentences.length && (sentences.join(" ").length + text.length > personality.maxCharacters || sentences.length >= personality.maxClaims)) continue;
    sentences.push(text);
    renderedClaims.push({...item, slots: {...item.slots}, evidence: item.evidence.map(ref => ({...ref})),
      sourceIds: [...item.sourceIds], ...(item.position ? {position: {...item.position}} : {}),
      ...(item.opening ? {opening: {...item.opening}} : {}),
      ...(item.tactic ? {tactic: {...item.tactic, effect: item.tactic.effect.kind === "fork"
        ? {...item.tactic.effect, targets: [...item.tactic.effect.targets]} : {...item.tactic.effect}}} : {})});
    variants.push({code: item.code, index, sourceIds: item.sourceIds, source,
      form: typeof wording === "string" ? "sentence" : "composed", cues: composition.cues, order: composition.order});
  }
  const text = sentences.join(" ") || "I don't have a clear explanation for this position yet.";
  return {version: "coach-utterance-1", id: `cu1:${stableKey([intent.id, character.id, personality.version, text])}`,
    intentId: intent.id, coachId: character.id, text, expression: intent.expression,
    intensity: intent.intensity, priority: intent.priority, interruptible: intent.interruptible,
    autoSpeakSuitable: intent.autoSpeakSuitable,
    delivery: personality.delivery,
    renderedClaims,
    trace: {renderer: personality.version, variants, composition: {strategy, claimCount: variants.length,
      questionCount: (text.match(/\?/g) ?? []).length, sentenceCount: sentenceCount(text),
      characterClaims: variants.filter(v => v.source === personality.version && personality !== neutralPersonality).length,
      fallbackClaims: variants.filter(v => v.source !== personality.version || personality === neutralPersonality).length},
    decisions: intent.decisions}};
}
