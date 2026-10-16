import { test, expect, type Page } from "@playwright/test";
import type { Schema } from "../src/api";

const section = (page: Page) => page.getByRole("region", { name: "Server", exact: true });

function listing(
  slots: number,
  running = 4,
  restart_available = true,
  boot_id = "first-boot",
): Schema["ServerSettings"] {
  return {
    restart_available,
    boot_id,
    groups: [
      {
        title: "Engine",
        settings: [
          {
            key: "engine_slots",
            label: "Shared engine slots",
            help: "Engines at once.",
            kind: "integer",
            nullable: false,
            choices: null,
            minimum: 1,
            maximum: 32,
            default: 4,
            value: slots,
            running,
          },
          {
            key: "triage_time",
            label: "First pass time",
            help: "Seconds per position.",
            kind: "number",
            nullable: false,
            choices: null,
            minimum: null,
            exclusive_minimum: 0,
            maximum: 30,
            default: 0.15,
            value: 0.15,
            running: 0.15,
          },
          {
            key: "reply_workers",
            label: "Reply workers",
            help: "Workers at once.",
            kind: "integer",
            nullable: false,
            choices: null,
            minimum: null,
            exclusive_minimum: 0,
            maximum: 8,
            default: 2,
            value: 2,
            running: 2,
          },
          {
            key: "triage_nodes",
            label: "First pass nodes",
            help: "Optional node limit.",
            kind: "integer",
            nullable: true,
            choices: null,
            minimum: 1,
            maximum: null,
            default: null,
            value: null,
            running: null,
          },
        ],
      },
      {
        title: "Maia",
        settings: [
          {
            key: "human_model_enabled",
            label: "Use Maia",
            help: "Predict human moves.",
            kind: "boolean",
            nullable: false,
            choices: null,
            minimum: null,
            maximum: null,
            default: true,
            value: true,
            running: true,
          },
        ],
      },
      {
        title: "Training",
        settings: [
          {
            key: "acceptance_mode",
            label: "Accepted answers",
            help: "Which moves count.",
            kind: "choice",
            nullable: false,
            choices: ["best_only", "practical"],
            minimum: null,
            maximum: null,
            default: "practical",
            value: "practical",
            running: "practical",
          },
        ],
      },
    ],
  };
}

test("server settings save to the database and restart the server", async ({ page }, info) => {
  const bodies: unknown[] = [];
  let restarts = 0;
  await page.route("**/api/server-settings", route => {
    // After the restart the server reports a new boot and runs the saved value.
    if (route.request().method() === "GET")
      return route.fulfill({ json: restarts ? listing(6, 6, true, "second-boot") : listing(4) });
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ json: listing(6) });
  });
  await page.route("**/api/server/restart", route => {
    restarts += 1;
    return route.fulfill({ status: 202, json: { ok: true } });
  });
  await page.goto("/settings?section=advanced");
  await expect(
    section(page).getByText("Analysis in progress stops and resumes afterwards."),
  ).toBeVisible();
  await section(page).getByText("Engine", { exact: true }).click();
  const slots = section(page).getByLabel("Shared engine slots");
  await slots.fill("");
  await slots.fill("6");
  await section(page).getByLabel("First pass nodes").fill("5000");
  await section(page).getByText("Maia", { exact: true }).click();
  await section(page).getByLabel("Use Maia").uncheck();
  await section(page).getByText("Training", { exact: true }).click();
  await section(page).getByLabel("Accepted answers").selectOption("best_only");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/settings-server-${info.project.name}.png`,
    fullPage: true,
  });
  await section(page).getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("region", { name: "Notifications" }).getByRole("status")).toHaveText(
    "Saved. Restart the server to apply the changes.",
  );
  expect(bodies).toEqual([
    {
      values: {
        engine_slots: 6,
        triage_nodes: 5000,
        human_model_enabled: false,
        acceptance_mode: "best_only",
      },
    },
  ]);
  await expect(section(page)).toContainText("1 saved change applies after a restart.");
  await expect(section(page)).toContainText("Running with 4 until restart.");

  await section(page).getByRole("button", { name: "Restart server" }).click();
  const reloaded = page.waitForEvent("load");
  await section(page).getByRole("button", { name: "Restart now" }).click();
  await expect(section(page).getByRole("button", { name: "Restarting…" })).toBeDisabled();
  await reloaded;
  expect(restarts).toBe(1);
  await expect(section(page).getByRole("button", { name: "Restart server" })).toBeEnabled();
  await expect(section(page)).not.toContainText("until restart");
});

test("servers that cannot restart themselves say so, and members never see the section", async ({
  page,
}) => {
  let forbidden = false;
  await page.route("**/api/server-settings", route =>
    forbidden
      ? route.fulfill({
          status: 403,
          json: { detail: "Only an administrator can change server settings." },
        })
      : route.fulfill({ json: listing(4, 4, false) }),
  );
  await page.goto("/settings?section=advanced");
  await expect(section(page)).toContainText("restart it from the host");
  await expect(section(page).getByRole("button", { name: "Restart server" })).toHaveCount(0);
  forbidden = true;
  await page.reload();
  await expect(page.getByRole("region", { name: "Training tools" })).toBeVisible();
  await expect(section(page)).toHaveCount(0);
});

test("a strictly positive setting is refused before saving, in the server wording", async ({
  page,
}) => {
  const bodies: unknown[] = [];
  await page.route("**/api/server-settings", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: listing(4) });
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ json: listing(4) });
  });
  await page.goto("/settings?section=advanced");
  await section(page).getByText("Engine", { exact: true }).click();
  // A whole-number field starts at the next whole number above the bound.
  await expect(section(page).getByLabel("Reply workers")).toHaveAttribute("min", "1");
  // A decimal one has no smallest value above it, so the form checks it before saving.
  const time = section(page).getByLabel("First pass time");
  await expect(time).not.toHaveAttribute("min");
  await time.fill("0");
  await section(page).getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("region", { name: "Notifications" }).getByRole("alert")).toHaveText(
    "First pass time must be greater than 0.",
  );
  expect(bodies).toEqual([]);
  await time.fill("0.1");
  await section(page).getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("region", { name: "Notifications" }).getByRole("status")).toHaveText(
    "Saved. Restart the server to apply the changes.",
  );
  expect(bodies).toEqual([{ values: { triage_time: 0.1 } }]);
});
