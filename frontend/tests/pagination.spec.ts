import { test, expect } from "./helpers/browserTest";

test("Catalogue pages retain search filters, fifty-item ranges and empty-page recovery", async ({
  page,
}) => {
  await page.route("**/api/openings/catalog?*", route => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
    return route.fulfill({
      json: {
        total: 51,
        items: Array.from({ length: offset === 0 ? 50 : offset === 50 ? 1 : 0 }, (_, index) => ({
          source_key: `line-${offset + index}`,
          name: `Line ${offset + index}`,
          eco: "A00",
          white_positions: 2,
          black_positions: 2,
        })),
      },
    });
  });
  await page.goto("/study/openings/catalogue?q=Amar&eco=A00");
  const pages = page.getByRole("navigation", { name: "Opening catalogue pages" });
  await expect(pages).toContainText("1–50 of 51");
  await expect(pages.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
  await expect(pages.getByRole("link", { name: "Next", exact: true })).toHaveAttribute(
    "href",
    "/study/openings/catalogue?q=Amar&eco=A00&offset=50",
  );
  await pages.getByRole("link", { name: "Next", exact: true }).click();
  await expect(pages).toContainText("51–51 of 51");
  await expect(pages.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.goto("/study/openings/catalogue?q=Amar&eco=A00&offset=100");
  await expect(page.getByText("No opening lines match this search.")).toBeVisible();
  await pages.getByRole("link", { name: "Previous", exact: true }).click();
  await expect(page).toHaveURL("/study/openings/catalogue?q=Amar&eco=A00&offset=50");
  await expect(pages).toContainText("51–51 of 51");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
