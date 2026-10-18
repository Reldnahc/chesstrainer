import { test, expect } from "../tests/helpers/browserTest";
import path from "node:path";

test("the full cast has structural voices and common scenarios preserve facts without neutral collapse", async ({
  page,
}) => {
  await page.goto("/");
  const frontend = `/@fs/${path.resolve(".").replaceAll("\\", "/")}`;
  const result = await page.evaluate(async root => {
    const { selectableCoaches } = await import(`${root}/src/coach/registry.ts`);
    const { renderDialogue } = await import(`${root}/src/dialogue/neutral.ts`);
    const { writingExamples, comparisonExamples, exampleIntent } = await import(
      `${root}/intelligence-lab/examples.ts`
    );
    const { auditCorpus } = await import(`${root}/intelligence-lab/corpus.ts`);
    const { practiceIntent } = await import(`${root}/src/dialogue/practiceIntent.ts`);
    const { claim, makeIntent } = await import(`${root}/src/dialogue/model.ts`);
    const strategies = new Set<string>(),
      caps = new Set<number>(),
      signatures = new Set<string>();
    const violations: string[] = [];
    let questions = 0,
      composed = 0;
    for (const coach of selectableCoaches) {
      caps.add(coach.personality.maxClaims);
      signatures.add(coach.personality.behavior.signature);
      for (const code of ["allowed_mate", "tactic_played", "tactic_allowed", "tactic_missed"]) {
        const sparse = makeIntent(
          `sparse:${code}`,
          code === "tactic_played" ? "best" : "blunder",
          "game",
          "blunder",
          [
            claim(code, {
              move: "Ng5+",
              best: "Ng5+",
              motif: "fork",
              opponent: "Black",
              detail: "",
              reply: "",
            }),
          ],
        );
        const output = renderDialogue(sparse, coach);
        if (/[:;]\s*(?:[.!?]|$)/.test(output.text) || /\{\w+\}/.test(output.text))
          violations.push(`${coach.id}/${code}: empty optional payload left a label`);
        if (
          output.trace.variants[0]?.source !== coach.personality.version ||
          !/fork|mate/i.test(output.text)
        )
          violations.push(`${coach.id}/${code}: missing sparse factual claim`);
      }
      for (const failed of [false, true]) {
        const cold = practiceIntent({
          position: { session_id: "cold-cast", failed, theme: "POISON_FORK" },
          feedback: null,
          frame: { fen: "future-frame", annotation: "POISON_FORK Qh4# wins the queen" },
          hadFailure: failed,
          expression: failed ? "encouraging" : "neutral",
        });
        const output = renderDialogue(cold, coach);
        if (
          !cold.decisions.includes("cold_feedback_gate") ||
          output.trace.variants.some(
            (variant: { code: string }) => !["cold", "retry"].includes(variant.code),
          )
        )
          violations.push(`${coach.id}: escaped cold gate`);
        if (/POISON|Qh4|\b(fork|queen|checkmate|sacrifice)\b/i.test(output.text))
          violations.push(`${coach.id}: leaked cold answer`);
      }
      for (const index of comparisonExamples)
        for (let take = 0; take < 12; take++) {
          const intent = exampleIntent(index, take),
            before = JSON.stringify(intent);
          const output = renderDialogue(intent, coach);
          const prefix = `${coach.id}/${writingExamples[index].label ?? intent.purpose}`;
          if (before !== JSON.stringify(intent)) violations.push(`${prefix}: mutated facts`);
          if (JSON.stringify(output) !== JSON.stringify(renderDialogue(intent, coach)))
            violations.push(`${prefix}: not deterministic`);
          for (const key of [
            "expression",
            "intensity",
            "priority",
            "interruptible",
            "autoSpeakSuitable",
          ])
            if (output[key] !== intent[key]) violations.push(`${prefix}: changed ${key}`);
          if (output.trace.variants[0]?.source !== coach.personality.version)
            violations.push(`${prefix}: primary fallback`);
          if (output.trace.variants.length > coach.personality.maxClaims)
            violations.push(`${prefix}: ignores claim cap`);
          for (const variant of output.trace.variants) {
            const claim = intent.claims.find(
              (item: { code: string }) => item.code === variant.code,
            );
            if (!claim || JSON.stringify(variant.sourceIds) !== JSON.stringify(claim.sourceIds))
              violations.push(`${prefix}: invented provenance`);
          }
          if (
            intent.claims[0].code === "tactic_missed" &&
            output.text.indexOf("Ng5+") > output.text.indexOf("The king and queen")
          )
            violations.push(`${prefix}: unplayed effects precede their scope`);
          if (/\d\s*%|percent of players|players at your rating/i.test(output.text))
            violations.push(`${prefix}: unsupported population wording`);
          strategies.add(output.trace.composition.strategy);
          questions += output.trace.composition.questionCount;
          composed += output.trace.variants.filter(
            (variant: { form?: string }) => variant.form === "composed",
          ).length;
        }
    }
    return {
      count: selectableCoaches.length,
      strategies: [...strategies],
      caps: [...caps],
      signatures: signatures.size,
      questions,
      composed,
      violations,
      audit: auditCorpus(),
    };
  }, frontend);
  expect(result.count).toBe(30);
  expect(result.signatures).toBe(result.count);
  expect(result.strategies.sort()).toEqual([
    "calm-reset",
    "consequence-first",
    "mentor-first",
    "minimal",
    "observation-first",
    "pattern-first",
    "question-first",
    "reaction-first",
  ]);
  expect(result.caps.sort()).toEqual([1, 2]);
  expect(result.questions).toBeGreaterThan(0);
  expect(result.composed).toBeGreaterThan(result.count * 10);
  expect(result.violations).toEqual([]);
  expect(result.audit.errors).toEqual([]);
  expect(result.audit.warnings).toEqual([]);
});
