import { test, expect } from "../tests/helpers/browserTest";
import path from "node:path";
import { viteFsPath } from "../studio-tests/helpers/viteFsPath";
import { inspectPosition } from "../intelligence-lab/inspection";
import type { Game } from "../src/gameReview/types";

// Deliberately synthetic diagnostic fixture, not a stored engine benchmark.
const fixture = {
  id: "synthetic-lab",
  white: "Example",
  black: "Fixture",
  orientation: "white",
  rating: 1200,
  result: "*",
  job: null,
  accuracy: null,
  white_rating: 1200,
  black_rating: 1400,
  played_on: null,
  review_revision: 0,
  frames: [
    {
      fen: "8/7k/8/8/4q3/5N2/8/K7 w - - 0 1",
      san: "Start",
      actor: null,
      turn: "white",
      number: 1,
      report: null,
      legal_moves: [],
      result: null,
      termination: null,
    },
    {
      fen: "8/7k/8/6N1/4q3/8/8/K7 b - - 1 1",
      san: "Ng5+",
      actor: "white",
      turn: "black",
      number: 1,
      legal_moves: [],
      result: null,
      termination: null,
      report: {
        label: "Best",
        engine_label: "Best",
        actual: { uci: "f3g5", san: "Ng5+", score: { kind: "cp", value: 0 } },
        best: { uci: "f3g5", san: "Ng5+", score: { kind: "cp", value: 0 } },
        before_analysis_id: "synthetic-search",
        played_analysis_id: "synthetic-search",
        depth: 16,
        engine_version: "synthetic-fixture",
        reason: "Example",
        intelligence: {
          version: "move-events-4",
          input_digest: "demo-facts",
          ply: 1,
          clock: null,
          limitations: [],
          events: [
            {
              id: "demo-fork",
              kind: "tactic",
              actor: "white",
              confidence: "line_witness",
              importance: 75,
              facts: {
                role: "played",
                motif: "fork",
                roles: { targets: ["e4", "h7"] },
                pieces: {
                  e4: { piece: "queen", color: "black" },
                  h7: { piece: "king", color: "black" },
                },
              },
              evidence: [
                { source: "stockfish", id: "synthetic-search", field: "actual_line/findings/0" },
              ],
            },
          ],
        },
      },
    },
  ],
} as unknown as Game;

test("shared dialogue keeps production announcements and supports passive definition-list samples", async ({
  page,
}) => {
  const utterance = inspectPosition(fixture, 1).utterance;
  await page.goto("/");
  const lines = await page.evaluate(
    async ({ root, utterance }) => {
      const { React, createRoot } = await import(`${root}/studio-tests/fixtures/runtime.ts`);
      const { default: DialogueText } = await import(`${root}/src/dialogue/DialogueText.tsx`);
      const container = document.createElement("div");
      document.body.append(container);
      const mounted = createRoot(container);
      try {
        await new Promise<void>(resolve => {
          function Preview() {
            React.useEffect(() => {
              resolve();
            }, []);
            return React.createElement(
              React.Fragment,
              null,
              React.createElement(DialogueText, { utterance }),
              React.createElement(
                "dl",
                null,
                React.createElement("dt", null, "Sample"),
                React.createElement(DialogueText, { utterance, as: "dd", announce: false }),
              ),
            );
          }
          mounted.render(React.createElement(Preview));
        });
        return [...container.querySelectorAll("[data-utterance]")].map(element => ({
          tag: element.tagName,
          parent: element.parentElement?.tagName,
          live: element.getAttribute("aria-live"),
          text: element.textContent,
          utterance: element.getAttribute("data-utterance"),
          intent: element.getAttribute("data-intent"),
          coach: element.getAttribute("data-dialogue-coach"),
        }));
      } finally {
        mounted.unmount();
        container.remove();
      }
    },
    { root: viteFsPath(path.resolve(".")), utterance },
  );
  expect(lines).toHaveLength(2);
  expect(lines[0]).toMatchObject({ tag: "P", live: "polite" });
  expect(lines[1]).toMatchObject({ tag: "DD", parent: "DL", live: "off" });
  for (const line of lines) {
    expect(line).toMatchObject({
      utterance: utterance.id,
      intent: utterance.intentId,
      coach: utterance.coachId,
      text: utterance.text,
    });
  }
});
