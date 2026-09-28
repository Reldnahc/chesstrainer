import { test, expect } from "@playwright/test";

test("lazy and recovered engine use stays available without an endless checking notice", async ({
  page,
}) => {
  let status: "unchecked" | "unavailable" | "ready" = "unchecked";
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        database: "ready",
        classification_available: true,
        engine_status: status,
        engine_available: status === "unchecked" ? null : status === "ready",
        engine_error:
          status === "unavailable"
            ? "Stockfish is unavailable. Check the server logs."
            : null,
        engine_version: status === "ready" ? "Stockfish fixture" : null,
      },
    }),
  );
  let queued = 0;
  await page.route("**/api/classifications/enrich", (route) => {
    queued++;
    return route.fulfill({ json: { job_id: "health-fixture" } });
  });
  await page.goto("/import");
  for (const state of ["unchecked", "unavailable", "ready"] as const) {
    status = state;
    await page.goto("/games");
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Settings", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Import games" }),
    ).toBeVisible();
    await expect(page.getByText("Checking engine availability…")).toHaveCount(
      0,
    );
    await expect(
      page.getByText("Stockfish is unavailable. Check the server logs."),
    ).toHaveCount(state === "unavailable" ? 1 : 0);
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Settings" })
      .click();
    await page
      .getByRole("button", { name: "Deepen unclear positions" })
      .click();
    await expect(page.getByRole("status").filter({hasText: "Additional analysis queued"})).toContainText(
      "Additional analysis queued",
    );
  }
  expect(queued).toBe(3);
});
