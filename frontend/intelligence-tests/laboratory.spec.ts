import {test, expect} from "@playwright/test";
import {readFileSync, readdirSync} from "node:fs";
import {gameIntent} from "../src/dialogue/gameIntent";
import {inspectPosition, parseReview} from "../intelligence-lab/inspection";
import type {Game} from "../src/gameReview/types";

// Deliberately synthetic diagnostic fixture, not a stored engine benchmark.
const fixture = {
  id: "synthetic-lab", white: "Example", black: "Fixture", orientation: "white", rating: 1200,
  result: "*", job: null, accuracy: null, white_rating: 1200, black_rating: 1400, played_on: null, review_revision: 0,
  frames: [
    {fen: "8/7k/8/8/4q3/5N2/8/K7 w - - 0 1", san: "Start", actor: null, turn: "white", number: 1, report: null, legal_moves: [], result: null, termination: null},
    {fen: "8/7k/8/6N1/4q3/8/8/K7 b - - 1 1", san: "Ng5+", actor: "white", turn: "black", number: 1, legal_moves: [], result: null, termination: null,
      report: {label: "Best", engine_label: "Best", actual: {uci: "f3g5", san: "Ng5+", score: {kind: "cp", value: 0}}, best: {uci: "f3g5", san: "Ng5+", score: {kind: "cp", value: 0}},
        before_analysis_id: "synthetic-search", played_analysis_id: "synthetic-search", depth: 16, engine_version: "synthetic-fixture", reason: "Example",
        intelligence: {version: "move-events-3", input_digest: "demo-facts", ply: 1, clock: null, limitations: [], events: [
          {id: "demo-fork", kind: "tactic", actor: "white", confidence: "line_witness", importance: 75,
            facts: {role: "played", motif: "fork", roles: {targets: ["e4", "h7"]}, pieces: {e4: {piece: "queen", color: "black"}, h7: {piece: "king", color: "black"}}},
            evidence: [{source: "stockfish", id: "synthetic-search", field: "actual_line/findings/0"}]},
        ]},
      }},
  ],
} as unknown as Game;

test("inspection is the same deterministic production dialogue and malformed evidence is rejected", () => {
  const inspection = inspectPosition(fixture, 1);
  const production = gameIntent({game: fixture, frame: fixture.frames[1], report: fixture.frames[1].report,
    ply: 1, key: "synthetic-lab:1:", expression: "check"});
  expect(inspection.intent).toEqual(production);
  expect(inspection.utterance.text).toContain("queen on e4 and king on h7");
  expect(parseReview(JSON.stringify(fixture))).toEqual(fixture);
  expect(() => parseReview('{"frames":[]}')).toThrow(/Expected/);
  expect(() => parseReview(JSON.stringify(fixture).replace("move-events-3", "move-events-99"))).toThrow(/current server/);
  expect(() => parseReview(JSON.stringify({...fixture, frames: [{...fixture.frames[1], report: {label: "Best"}}]}))).toThrow(/incompatible/);
});

test("laboratory traces a local review without network or storage and retains it after invalid input", async ({page}, info) => {
  const apiCalls: string[] = [];
  page.on("request", r => {if (r.url().includes("/api/")) apiCalls.push(r.url());});
  await page.goto("/");
  await expect(page.getByRole("heading", {name: "Review intelligence laboratory"})).toBeVisible();
  await page.getByLabel("Open game-detail JSON").setInputFiles({name: "synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture))});
  await expect(page.locator(".lab-utterance")).toContainText("queen on e4 and king on h7");
  await expect(page.getByRole("region", {name: "Rendered coach line"})).toContainText("di1:");
  await expect(page.locator(".lab-chain")).toContainText("synthetic-search");
  await page.getByRole("button", {name: "Previous", exact: true}).click();
  await expect(page.getByLabel("Position", {exact: true})).toHaveValue("0");
  await page.getByRole("button", {name: "Next", exact: true}).click();
  await expect(page.locator(".lab-utterance")).toContainText("fork");
  await page.getByLabel("Open game-detail JSON").setInputFiles({name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{}")});
  await expect(page.getByRole("alert")).toContainText("Expected");
  await expect(page.locator(".lab-utterance")).toContainText("fork");
  expect(apiCalls).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `intelligence-test-results/lab-${info.project.name}.png`, fullPage: true});
});

test("production JavaScript excludes the laboratory", () => {
  const assets = readdirSync("dist/assets").filter(n => n.endsWith(".js")).map(n => readFileSync(`dist/assets/${n}`, "utf8")).join("\n");
  expect(assets).not.toContain("Review intelligence laboratory");
  expect(assets).not.toContain("Open game-detail JSON");
});
