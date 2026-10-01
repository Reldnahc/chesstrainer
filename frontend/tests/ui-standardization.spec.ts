import { expect, test, type Locator } from "@playwright/test";

async function sectionAppearance(navigation: Locator) {
  return navigation.evaluate(element => {
    const tray = getComputedStyle(element);
    const selected = element.querySelector('[aria-current="page"]')!;
    const link = getComputedStyle(selected);
    return {
      tray: [tray.backgroundColor, tray.border, tray.borderRadius, tray.padding, tray.gap],
      link: [link.backgroundColor, link.color, link.boxShadow, link.padding, link.fontSize, link.minHeight],
      height: selected.getBoundingClientRect().height,
    };
  });
}

test("Settings and Openings share section navigation appearance and preserve URL history", async ({ page }) => {
  const documents: string[] = [];
  page.on("request", request => { if (request.isNavigationRequest()) documents.push(request.url()); });
  await page.goto("/settings?section=advanced");
  const settings = page.getByRole("navigation", { name: "Settings sections" });
  await expect(settings.getByRole("link", { name: "Advanced", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(settings.getByRole("link", { name: "Account", exact: true })).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const settingsAppearance = await sectionAppearance(settings);
  expect(settingsAppearance.height).toBeGreaterThanOrEqual(44);

  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Study", exact: true }).click();
  await page.getByRole("link", { name: "Explore openings", exact: true }).click();
  const openings = page.getByRole("navigation", { name: "Opening study modes" });
  await expect(openings.getByRole("link")).toHaveText(["Lessons", "Catalogue", "My studies"]);
  await expect(openings.getByRole("link", { name: "Lessons", exact: true })).toHaveAttribute("aria-current", "page");
  expect(await sectionAppearance(openings)).toEqual(settingsAppearance);
  const originalBounds = await openings.boundingBox();
  await openings.getByRole("link", { name: "Catalogue", exact: true }).click();
  await expect(page).toHaveURL("/study/openings/catalogue");
  await expect(openings.getByRole("link", { name: "Catalogue", exact: true })).toHaveAttribute("aria-current", "page");
  expect(await openings.boundingBox()).toEqual(originalBounds);
  await page.goBack();
  await expect(page).toHaveURL("/study/openings");
  await expect(openings.getByRole("link", { name: "Lessons", exact: true })).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(openings.getByRole("link", { name: "Catalogue", exact: true })).toHaveAttribute("aria-current", "page");
  expect(documents).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("section navigation keeps phone targets and disappears inside a lesson course", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const { route, links } of [
    { route: "/settings?section=advanced", links: ["Games & imports", "Coach & animations", "Sound", "Advanced"] },
    { route: "/study/openings", links: ["Lessons", "Catalogue", "My studies"] },
  ]) {
    await page.goto(route);
    const navigation = page.locator(".section-navigation");
    await expect(navigation.getByRole("link")).toHaveText(links);
    for (const link of await navigation.getByRole("link").all()) {
      await expect(link).toBeInViewport();
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.locator(".lesson-course-card").first().click();
  await expect(page.locator(".lesson-course")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Opening study modes" })).toHaveCount(0);
  await page.getByRole("link", { name: "All openings", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Opening study modes" })).toBeVisible();
});
