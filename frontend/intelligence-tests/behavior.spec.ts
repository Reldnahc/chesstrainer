import {test, expect} from "@playwright/test";
import path from "node:path";
import {renderDialogue} from "../src/dialogue/neutral";
import {claim, makeIntent} from "../src/dialogue/model";
import {neutralPersonality, type CommunicationBehavior, type ResponseStrategy} from "../src/dialogue/personality";

const behavior: CommunicationBehavior = {
  general: "observation-first", praise: "reaction-first", correction: "consequence-first",
  questionFrequency: "often", directness: 3, emotionalAmplitude: 3, humor: 1, jargon: 2,
  playerAddress: "occasional", sentenceLength: "mixed", metaphor: "none", signature: "An explicit renderer test profile, not a selectable coach.",
};
const fact = "{move} finds a {motif}.", consequence = "{detail}";
const makeCharacter = (strategy: ResponseStrategy) => ({id: "test-composition", personality: {
  ...neutralPersonality, version: "composition-test", behavior: {...behavior, general: strategy, praise: strategy, correction: strategy},
  templates: {tactic_played: [{fact, consequence, reaction: "Nicely spotted!", question: "What connects the targets?", observation: "Consider the targets.", takeaway: "Follow the continuation."}]},
}});

test("strategies change response structure while all factual fragments and provenance survive", () => {
  const intent = makeIntent("shape", "best", "game", "best", [claim("tactic_played", {move: "Ng5+", motif: "fork", detail: "The king and queen are attacked together."}, 90, [], ["fork-witness"])]);
  const saved = JSON.stringify(intent);
  const consequenceFirst = renderDialogue(intent, makeCharacter("consequence-first"));
  const reactionFirst = renderDialogue(intent, makeCharacter("reaction-first"));
  const minimal = renderDialogue(intent, makeCharacter("minimal"));
  expect(consequenceFirst.text.indexOf("king and queen")).toBeLessThan(consequenceFirst.text.indexOf("Ng5+"));
  expect(reactionFirst.text).toMatch(/^Nicely spotted!/);
  expect(minimal.text).not.toMatch(/Nicely|Consider|Follow|\?/);
  for (const output of [consequenceFirst, reactionFirst, minimal]) {
    expect(output.text).toContain("Ng5+ finds a fork.");
    expect(output.text).toContain("The king and queen are attacked together.");
    expect(output.trace.variants[0].sourceIds).toEqual(["fork-witness"]);
    expect(output.trace.variants[0].form).toBe("composed");
    expect(output.intentId).toBe(intent.id);
  }
  expect(JSON.stringify(intent)).toBe(saved);
  const missed = makeIntent("missed-scope", "missed", "game", "missed", [claim("tactic_missed",
    {best: "Ng5+", motif: "fork", detail: "The king and queen are attacked together."})]);
  const character = makeCharacter("consequence-first");
  const scoped = renderDialogue(missed, {...character, personality: {...character.personality,
    templates: {tactic_missed: [{fact: "The missed resource was {best}, with a {motif}.", consequence}]}}});
  expect(scoped.trace.variants[0].order).toBe("fact-first");
  expect(scoped.text.indexOf("Ng5+")).toBeLessThan(scoped.text.indexOf("king and queen"));
});

test("optional questions are deterministic and required facts cannot be hidden in an optional cue", () => {
  const character = makeCharacter("question-first");
  const outputs = Array.from({length: 40}, (_, take) => {
    const intent = makeIntent(`question:${take}`, "best", "game", "best", [claim("tactic_played", {move: "Ng5+", motif: "fork", detail: "The king and queen are attacked together."})]);
    const output = renderDialogue(intent, character);
    expect(renderDialogue(intent, character)).toEqual(output);
    return output;
  });
  const questions = outputs.filter(output => output.trace.composition?.questionCount);
  expect(questions.length).toBeGreaterThan(0);
  expect(questions.length).toBeLessThan(outputs.length);
  const malformed = {...character, personality: {...character.personality, templates: {
    tactic_played: [{fact: "A fork.", question: "Was {move} the idea? {motif} {detail}"}],
  }}};
  const intent = makeIntent("incomplete", "best", "game", "best", [claim("tactic_played", {move: "Ng5+", motif: "fork", detail: "Two targets."})]);
  expect(renderDialogue(intent, malformed).trace.variants[0].source).toBe("neutral-1");
  const opponent = renderDialogue({...intent, subject: "opponent"}, character);
  expect(opponent.trace.composition?.strategy).toBe("minimal");
  expect(opponent.trace.variants[0].source).toBe("neutral-1");
  expect(opponent.text).not.toContain("?");
});

test("the full cast has structural voices and common scenarios preserve facts without neutral collapse", async ({page}) => {
  await page.goto("/");
  const frontend = `/@fs/${path.resolve(".").replaceAll("\\", "/")}`;
  const result = await page.evaluate(async root => {
    const {selectableCoaches} = await import(`${root}/src/coach/registry.ts`);
    const {renderDialogue} = await import(`${root}/src/dialogue/neutral.ts`);
    const {writingExamples, comparisonExamples, exampleIntent} = await import(`${root}/intelligence-lab/examples.ts`);
    const {auditCorpus} = await import(`${root}/intelligence-lab/corpus.ts`);
    const {practiceIntent} = await import(`${root}/src/dialogue/practiceIntent.ts`);
    const {claim, makeIntent} = await import(`${root}/src/dialogue/model.ts`);
    const strategies = new Set<string>(), caps = new Set<number>(), signatures = new Set<string>();
    const violations: string[] = [];
    let questions = 0, composed = 0;
    for (const coach of selectableCoaches) {
      caps.add(coach.personality.maxClaims);
      signatures.add(coach.personality.behavior.signature);
      for (const code of ["allowed_mate", "tactic_played", "tactic_allowed", "tactic_missed"]) {
        const sparse = makeIntent(`sparse:${code}`, code === "tactic_played" ? "best" : "blunder", "game", "blunder",
          [claim(code, {move: "Ng5+", best: "Ng5+", motif: "fork", opponent: "Black", detail: "", reply: ""})]);
        const output = renderDialogue(sparse, coach);
        if (/[:;]\s*(?:[.!?]|$)/.test(output.text) || /\{\w+\}/.test(output.text)) violations.push(`${coach.id}/${code}: empty optional payload left a label`);
        if (output.trace.variants[0]?.source !== coach.personality.version || !/fork|mate/i.test(output.text)) violations.push(`${coach.id}/${code}: missing sparse factual claim`);
      }
      for (const failed of [false, true]) {
        const cold = practiceIntent({position: {session_id: "cold-cast", failed, theme: "POISON_FORK"}, feedback: null,
          frame: {fen: "future-frame", annotation: "POISON_FORK Qh4# wins the queen"}, hadFailure: failed, expression: failed ? "encouraging" : "neutral"});
        const output = renderDialogue(cold, coach);
        if (!cold.decisions.includes("cold_feedback_gate") || output.trace.variants.some((variant: {code: string}) => !["cold", "retry"].includes(variant.code))) violations.push(`${coach.id}: escaped cold gate`);
        if (/POISON|Qh4|\b(fork|queen|checkmate|sacrifice)\b/i.test(output.text)) violations.push(`${coach.id}: leaked cold answer`);
      }
      for (const index of comparisonExamples) for (let take = 0; take < 12; take++) {
        const intent = exampleIntent(index, take), before = JSON.stringify(intent);
        const output = renderDialogue(intent, coach);
        const prefix = `${coach.id}/${writingExamples[index].label ?? intent.purpose}`;
        if (before !== JSON.stringify(intent)) violations.push(`${prefix}: mutated facts`);
        if (JSON.stringify(output) !== JSON.stringify(renderDialogue(intent, coach))) violations.push(`${prefix}: not deterministic`);
        for (const key of ["expression", "intensity", "priority", "interruptible", "autoSpeakSuitable"]) if (output[key] !== intent[key]) violations.push(`${prefix}: changed ${key}`);
        if (output.trace.variants[0]?.source !== coach.personality.version) violations.push(`${prefix}: primary fallback`);
        if (output.trace.variants.length > coach.personality.maxClaims) violations.push(`${prefix}: ignores claim cap`);
        for (const variant of output.trace.variants) {
          const claim = intent.claims.find((item: {code: string}) => item.code === variant.code);
          if (!claim || JSON.stringify(variant.sourceIds) !== JSON.stringify(claim.sourceIds)) violations.push(`${prefix}: invented provenance`);
        }
        if (intent.claims[0].code === "tactic_missed" && output.text.indexOf("Ng5+") > output.text.indexOf("The king and queen")) violations.push(`${prefix}: unplayed effects precede their scope`);
        if (/\d\s*%|percent of players|players at your rating/i.test(output.text)) violations.push(`${prefix}: unsupported population wording`);
        strategies.add(output.trace.composition.strategy);
        questions += output.trace.composition.questionCount;
        composed += output.trace.variants.filter((variant: {form?: string}) => variant.form === "composed").length;
      }
    }
    return {count: selectableCoaches.length, strategies: [...strategies], caps: [...caps], signatures: signatures.size, questions, composed, violations, audit: auditCorpus()};
  }, frontend);
  expect(result.count).toBe(30);
  expect(result.signatures).toBe(result.count);
  expect(result.strategies.sort()).toEqual(["calm-reset", "consequence-first", "mentor-first", "minimal", "observation-first", "pattern-first", "question-first", "reaction-first"]);
  expect(result.caps.sort()).toEqual([1, 2]);
  expect(result.questions).toBeGreaterThan(0);
  expect(result.composed).toBeGreaterThan(result.count * 10);
  expect(result.violations).toEqual([]);
  expect(result.audit.errors).toEqual([]);
  expect(result.audit.warnings).toEqual([]);
});
