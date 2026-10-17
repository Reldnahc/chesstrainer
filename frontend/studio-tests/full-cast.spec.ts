import { expect, test, type Page } from "../tests/helpers/browserTest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { viteFsPath } from "./helpers/viteFsPath";
import type { CoachDefinition } from "../src/coach/model";

// Use the canonical selectable IDs without importing artwork/CSS into Node.
// The roster test below requires this collection to match the browser registry.
const contract = JSON.parse(
  readFileSync(path.resolve("../backend/tests/fixtures/api_contract.json"), "utf8"),
);
const coachIds: string[] = contract.components.schemas.CoachPreferences.properties.coach_id.enum;

async function readCast(page: Page) {
  const root = viteFsPath(path.resolve("."));
  return page.evaluate(async root => {
    const { selectableCoaches } = await import(`${root}/src/coach/registry.ts`);
    return selectableCoaches.map((coach: CoachDefinition) => ({ id: coach.id })) as {
      id: string;
    }[];
  }, root);
}

test("the complete cast matches the canonical selectable roster", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Motion intensity" }).selectOption("still");
  const cast = await readCast(page);
  const roster = page.locator(".studio-cast button");
  await expect(roster).toHaveCount(cast.length);
  const ids = await roster
    .locator(".coach-avatar")
    .evaluateAll(avatars => avatars.map(avatar => avatar.getAttribute("data-coach")!));
  expect([...new Set(ids)].sort()).toEqual(cast.map(coach => coach.id).sort());
  expect(cast.map(coach => coach.id).sort()).toEqual([...coachIds].sort());
  for (const retired of ["dog-sunny", "cat-tabby", "cat-calico"])
    expect(ids).not.toContain(retired);
  for (const retained of ["classic", "dog-gentle", "cat-tuxedo", "cat-black"])
    expect(ids).toContain(retained);
});
