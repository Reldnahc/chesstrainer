import { expect, test } from "@playwright/test";

function gate() {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  return { waiting, release };
}

test("preference status shares loading and saving presentation without mixing each field's saved state", async ({ page }) => {
  const load = gate(), coachSave = gate(), motionSave = gate();
  let coach = { coach_id: "classic", motion: "system" };
  let motion = { motion: "system" };
  await page.route("**/api/preferences/coach", async route => {
    if (route.request().method() === "GET") await load.waiting;
    else {
      await coachSave.waiting;
      coach = route.request().postDataJSON();
    }
    await route.fulfill({ json: coach });
  });
  await page.route("**/api/preferences/motion", async route => {
    if (route.request().method() === "GET") await load.waiting;
    else {
      await motionSave.waiting;
      motion = route.request().postDataJSON();
    }
    await route.fulfill({ json: motion });
  });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/settings?section=coach");
    const heading = page.locator(".coach-preference-status");
    const coachStatus = page.locator(".coach-motion-preference-status");
    const motionStatus = page.locator(".motion-preference-status");
    const coachField = page.getByLabel("Coach motion", { exact: true });
    const motionField = page.getByLabel("Piece & interface motion", { exact: true });
    for (const status of [heading, coachStatus, motionStatus]) {
      await expect(status).toHaveAttribute("role", "status");
      await expect(status).toHaveAttribute("aria-atomic", "true");
      await expect(status).toHaveText("Loading…");
    }
    await expect(heading).toHaveClass(/preference-status--heading/);
    await expect(coachStatus).toHaveClass(/preference-status--field/);
    await expect(motionStatus).toHaveClass(/preference-status--field/);
    await expect(coachField).toBeDisabled();
    await expect(motionField).toBeDisabled();
    load.release();
    await expect(coachField).toBeEnabled();
    await expect(motionField).toBeEnabled();
    await expect(heading).toBeEmpty();
    await expect(coachStatus).toHaveText("Still · device setting");
    await expect(motionStatus).toHaveText("Still · device setting");
    const populatedHeight = (await coachStatus.boundingBox())!.height;
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(coachStatus).toBeEmpty();
    await expect(motionStatus).toBeEmpty();
    expect((await coachStatus.boundingBox())!.height).toBeCloseTo(populatedHeight, 1);
    const idleHeight = (await motionStatus.boundingBox())!.height;

    await coachField.selectOption("natural");
    await expect(heading).toHaveText("Saving…");
    await expect(coachStatus).toHaveText("Saving…");
    await expect(coachField).toBeDisabled();
    await expect(motionStatus).toBeEmpty();
    await expect(motionField).toBeEnabled();
    coachSave.release();
    await expect(coachStatus).toHaveText("Saved");
    await expect(heading).toBeEmpty();
    expect(coach).toEqual({ coach_id: "classic", motion: "natural" });

    await motionField.selectOption("still");
    await expect(motionStatus).toHaveText("Saving…");
    await expect(motionField).toBeDisabled();
    await expect(coachStatus).toHaveText("Saved");
    motionSave.release();
    await expect(motionStatus).toHaveText("Saved");
    expect((await motionStatus.boundingBox())!.height).toBeCloseTo(idleHeight, 1);
    expect(motion).toEqual({ motion: "still" });
    await page.reload();
    await expect(coachField).toHaveValue("natural");
    await expect(motionField).toHaveValue("still");
    for (const status of [heading, coachStatus, motionStatus]) await expect(status).toBeEmpty();
  } finally {
    load.release();
    coachSave.release();
    motionSave.release();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("preference errors retain heading and field retry actions and recover through the existing providers", async ({ page }) => {
  const retryCoach = gate(), retryMotion = gate();
  let failCoach = true, failMotion = true;
  await page.route("**/api/preferences/coach", async route => {
    if (failCoach) return route.fulfill({ status: 503, json: { detail: "Coach preferences unavailable" } });
    await retryCoach.waiting;
    await route.fulfill({ json: { coach_id: "classic", motion: "system" } });
  });
  await page.route("**/api/preferences/motion", async route => {
    if (failMotion) return route.fulfill({ status: 503, json: { detail: "Motion preferences unavailable" } });
    await retryMotion.waiting;
    await route.fulfill({ json: { motion: "system" } });
  });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/settings?section=coach");
    const heading = page.locator(".coach-preference-status");
    const coachStatus = page.locator(".coach-motion-preference-status");
    const motionStatus = page.locator(".motion-preference-status");
    for (const status of [heading, coachStatus]) await expect(status).toContainText("Coach preferences unavailable");
    await expect(motionStatus).toContainText("Motion preferences unavailable");
    await expect(heading.getByRole("button", { name: "Reload preferences", exact: true })).toHaveAttribute("type", "button");
    await expect(coachStatus.getByRole("button", { name: "Reload coach motion preferences", exact: true })).toBeVisible();
    await expect(motionStatus.getByRole("button", { name: "Reload motion preferences", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    failCoach = false;
    await heading.getByRole("button", { name: "Reload preferences", exact: true }).click();
    await expect(heading).toHaveText("Loading…");
    await expect(coachStatus).toHaveText("Loading…");
    await expect(page.getByLabel("Coach motion", { exact: true })).toBeDisabled();
    retryCoach.release();
    await expect(page.getByLabel("Coach motion", { exact: true })).toBeEnabled();
    await expect(heading).toBeEmpty();
    await expect(coachStatus).toHaveText("Still · device setting");

    failMotion = false;
    await motionStatus.getByRole("button", { name: "Reload motion preferences", exact: true }).click();
    await expect(motionStatus).toHaveText("Loading…");
    await expect(page.getByLabel("Piece & interface motion", { exact: true })).toBeDisabled();
    retryMotion.release();
    await expect(page.getByLabel("Piece & interface motion", { exact: true })).toBeEnabled();
    await expect(motionStatus).toHaveText("Still · device setting");
  } finally {
    retryCoach.release();
    retryMotion.release();
    await page.unrouteAll({ behavior: "wait" });
  }
});
