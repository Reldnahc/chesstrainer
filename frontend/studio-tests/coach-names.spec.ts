import { expect, test } from "@playwright/test";
import path from "node:path";

// Keep IDs independent of display names: existing saved choices and studio links
// must keep finding the same character when a label becomes a personal name.
const names = {
  classic: "Walter",
  "man-host": "Desmond",
  "man-expert": "Kenji",
  "man-partner": "Arjun",
  "woman-captain": "Mara",
  "woman-analyst": "Iris",
  "woman-spark": "Zoe",
  "woman-blonde": "Poppy",
  "human-boy": "Milo",
  "human-girl": "Cleo",
  "dog-gentle": "Alfie",
  "dog-corgi": "Waffles",
  "dog-collie": "Scout",
  "dog-puppy": "Biscuit",
  "cat-tuxedo": "Felix",
  "cat-black": "Juniper",
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
type NamedCoach = { id: string; name: string; family: { name: string; coachId: string } };

test("personal names remain unique and share stable catalogue identities", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Motion intensity" }).selectOption("still");
  const frontend = `/@fs/${path.resolve(".").replaceAll("\\", "/")}`;
  const roster: { coaches: NamedCoach[]; defaultId: string; retired: { id: string; name: string }[] } = await page.evaluate(async root => {
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
  await page.goto("/?coach=cat-black&expression=neutral");
  const choice = page.getByRole("button", { name: "Preview Juniper", exact: true });
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  await expect(choice.locator(".coach-avatar")).toHaveAttribute("data-coach", "cat-black");
  await page.reload();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Preview Walter", exact: true }).click();
  await expect(page).toHaveURL(/coach=classic(?:&|$)/);
  await expect(page.getByRole("button", { name: "Preview Walter", exact: true })).toHaveAttribute("aria-pressed", "true");
});
