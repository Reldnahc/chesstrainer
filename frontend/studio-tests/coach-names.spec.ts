import { expect, test } from "@playwright/test";
import path from "node:path";

// Keep IDs independent of display names: existing saved choices and studio links
// must keep finding the same character when a label becomes a personal name.
const names = {
  classic: "Storyteller",
  "man-host": "Club host",
  "man-expert": "Endgame expert",
  "man-partner": "Creative partner",
  "woman-captain": "Club captain",
  "woman-analyst": "Quiet analyst",
  "woman-spark": "Bright spark",
  "woman-blonde": "Golden braid",
  "human-boy": "Milo",
  "human-girl": "Cleo",
  "dog-gentle": "Gentle professor",
  "dog-corgi": "Pocket captain",
  "dog-collie": "Scout",
  "dog-puppy": "Biscuit",
  "cat-tuxedo": "Midnight tactician",
  "cat-black": "Velvet night",
  "cat-kitten": "Pickle",
  gorilla: "Monty",
  raccoon: "Bandit",
  frog: "Fergus",
  capybara: "Winston",
  unicorn: "Celeste",
  wizard: "Orin",
  dragon: "Ember",
  ghost: "Wisp",
  alien: "Ziggy",
  robot: "Rivet",
  slime: "Pip",
  mushroom: "Button",
  "living-pawn": "Percy",
};

test("personal names remain unique and share stable catalogue identities", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Motion intensity" }).selectOption("still");
  const frontend = `/@fs/${path.resolve(".").replaceAll("\\", "/")}`;
  const roster = await page.evaluate(async root => {
    const { selectableCoaches, getCoach } = await import(`${root}/src/coach/registry.ts`);
    return {
      coaches: selectableCoaches.map((coach: {
        id: string; name: string; families: { name: string; coachId: string }[];
      }) => ({ id: coach.id, name: coach.name,
        family: { name: coach.families[0].name, coachId: coach.families[0].coachId } })),
      defaultId: getCoach(undefined).id,
      retired: ["dog-sunny", "cat-tabby", "cat-calico"].map(id => {
        const coach = getCoach(id);
        return { id: coach.id, name: coach.name };
      }),
    };
  }, frontend);
  expect(Object.fromEntries(roster.coaches.map(coach => [coach.id, coach.name]))).toEqual(names);
  expect(new Set(roster.coaches.map(coach => coach.name.toLowerCase())).size).toBe(roster.coaches.length);
  for (const coach of roster.coaches) {
    expect(coach.family.coachId).toBe(coach.id);
    expect(coach.family.name).toBe(coach.name);
    const choice = page.getByRole("button", { name: `Preview ${coach.name}`, exact: true });
    await expect(choice).toBeVisible();
    await expect(choice.locator(".coach-avatar")).toHaveAttribute("data-coach", coach.id);
  }
  expect(roster.defaultId).toBe("classic");
  expect(roster.retired).toEqual([
    { id: "dog-puppy", name: "Biscuit" },
    { id: "cat-kitten", name: "Pickle" },
    { id: "cat-kitten", name: "Pickle" },
  ]);
});

test("old ID bookmarks show the new name and restore the same coach after reload", async ({ page }) => {
  await page.goto("/?coach=dog-collie&expression=neutral");
  const choice = page.getByRole("button", { name: "Preview Scout", exact: true });
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  await expect(choice.locator(".coach-avatar")).toHaveAttribute("data-coach", "dog-collie");
  await page.reload();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Preview Rivet", exact: true }).click();
  await expect(page).toHaveURL(/coach=robot(?:&|$)/);
  await expect(page.getByRole("button", { name: "Preview Rivet", exact: true })).toHaveAttribute("aria-pressed", "true");
});
