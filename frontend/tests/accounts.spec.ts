import { test, expect, watchPageErrors, type Page } from "./helpers/browserTest";
import { audioCues, captureAudio } from "./helpers/audio";

async function settingsSection(page: Page, name: "Coach & animations" | "Sound" | "Account") {
  await page
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("link", { name, exact: true })
    .click();
}

async function submitSignup(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse(
      result =>
        new URL(result.url()).pathname === "/api/auth/signup" &&
        result.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Create account", exact: true }).click(),
  ]);
  expect(response.status(), "Account signup must succeed before onboarding").toBe(201);
}

test("account signup, engine-free sync, second-device login and private library", async ({
  page,
  browser,
  extraHTTPHeaders,
}, info) => {
  // Saving the username starts a sync, and Games only notices it finished on its next
  // 15 s status check before Update games is enabled again; with two devices this
  // test needs about 25 s, too close to the default 30 s on CI runners.
  test.setTimeout(60_000);
  const username = `friend-${info.project.name}`;
  await page.goto("/");
  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await submitSignup(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Finish for now", exact: true }).click();
  await page.getByRole("link", { name: "Games", exact: true }).click();
  await expect(page.getByLabel("Remembered Chess.com username")).toHaveCount(0);
  await page.getByRole("link", { name: "Import games in Settings", exact: true }).click();
  await expect(page).toHaveURL("/settings");
  await page.getByLabel("Remembered Chess.com username").fill(username);
  await page
    .getByRole("region", { name: "Recent Chess.com games", exact: true })
    .getByRole("button", { name: "Save username", exact: true })
    .click();
  await expect(page.getByText("Change Chess.com connection", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Games", exact: true }).click();
  await expect(page.getByLabel("Remembered Chess.com username")).toHaveCount(0);
  const syncResponse = page.waitForResponse(
    r => r.url().endsWith("/api/providers/chesscom/sync") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Update games", exact: true }).click();
  expect((await syncResponse).ok()).toBe(true);
  await expect(page.locator(".game-library-item")).toHaveCount(1, { timeout: 30000 });
  await expect(page.locator(".game-library-item")).toContainText(username);
  await expect(page.getByText(`Signed in as ${username}`)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
  expect(
    await page.locator(".app-header").evaluate(header => header.getBoundingClientRect().top),
  ).toBe(0);
  const gameHref = (await page.locator(".game-library-item").getAttribute("href"))!;
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("region", { name: "Account", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
  await settingsSection(page, "Coach & animations");
  await page.getByRole("radio", { name: "Ingrid", exact: true }).click();
  await expect(page.locator(".coach-preference-status")).toContainText("Saved");
  await page.getByLabel("Coach motion", { exact: true }).selectOption("still");
  await expect(page.locator(".coach-motion-preference-status")).toContainText("Saved");
  await page.getByLabel("Piece & interface motion", { exact: true }).selectOption("natural");
  await expect(page.locator(".motion-preference-status")).toContainText("Saved");
  await settingsSection(page, "Sound");
  const sound = page.getByRole("region", { name: "Sound", exact: true });
  await sound.getByRole("checkbox", { name: /^Board moves/ }).uncheck();
  await expect(sound.locator(".preference-status")).toHaveAttribute("data-state", "saved");
  const voiceSave = page.waitForResponse(
    response =>
      response.url().endsWith("/api/preferences/audio") && response.request().method() === "PUT",
  );
  await sound.getByLabel("Coach voice", { exact: true }).selectOption("manual");
  expect((await voiceSave).ok()).toBe(true);
  await expect(sound.locator(".preference-status")).toHaveAttribute("data-state", "saved");
  await expect(sound.getByRole("checkbox", { name: /^Review accents/ })).toHaveCount(0);
  const ownerAudio = { enabled: true, volume: 0.35, board: false, practice: true, voice: "manual" };
  expect(await (await page.request.get("/api/preferences/audio")).json()).toEqual(ownerAudio);
  await page.getByRole("link", { name: "Games", exact: true }).click();
  const jobs = await (await page.request.get("/api/jobs")).json();
  expect(jobs).toHaveLength(1);
  expect(jobs[0].kind).toBe("sync");
  expect(jobs[0].positions_triaged).toBe(0);
  await page.screenshot({ path: `test-results/accounts-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(`${gameHref}?ply=3`);
  await page.getByRole("button", { name: "Mute sound on this device", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unmute sound on this device", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await (await page.request.get("/api/preferences/audio")).json()).toEqual(ownerAudio);

  const second = await browser.newContext({ baseURL: "http://127.0.0.1:8766", extraHTTPHeaders });
  const secondErrors = watchPageErrors(second);
  try {
    const device = await second.newPage();
    await captureAudio(device);
    await device.goto(`${gameHref}?ply=3`);
    // Signed out, the link opens the review read-only, with sign-in in place of navigation.
    await expect(device.locator(".game-player-name", { hasText: "FixtureOpponent" })).toBeVisible();
    await expect(device.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
    await expect(device.getByRole("button", { name: /review$/ })).toHaveCount(0);
    expect(await device.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await device.screenshot({
      path: `test-results/shared-game-guest-${info.project.name}.png`,
      fullPage: true,
    });
    await device.getByRole("button", { name: "Sign in", exact: true }).click();
    await device.getByLabel("Username", { exact: true }).fill(username);
    await device.getByLabel("Password", { exact: true }).fill("test-only-password");
    await device.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(device).toHaveURL(`${gameHref}?ply=3`);
    await expect(device.locator(".game-player-name", { hasText: username })).toBeVisible();
    await expect(device.locator(".game-player-name", { hasText: "FixtureOpponent" })).toBeVisible();
    await expect(device.locator(".review-coach .coach-avatar")).toHaveAttribute(
      "data-motion",
      "still",
    );
    await expect(device.locator(".review-coach .coach-avatar")).toHaveAttribute(
      "data-coach",
      "woman-blonde",
    );
    await expect(
      device.locator(".game-move-list").getByRole("button", { name: /^2\. g4(?:, .+)?$/ }),
    ).toHaveAttribute("aria-current", "step");
    // Sound choices follow the account, while the first device's quick mute does not.
    await expect(
      device.getByRole("button", { name: "Mute sound on this device", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(await (await device.request.get("/api/preferences/audio")).json()).toEqual(ownerAudio);
    expect(await audioCues(device)).toEqual([]);
    await device.getByRole("button", { name: "Mute sound on this device", exact: true }).click();
    await device.getByRole("link", { name: "Games", exact: true }).click();
    await expect(device.locator(".game-library-item")).toHaveCount(1);
    await device.getByRole("link", { name: "Home", exact: true }).click();
    const recentGames = device.getByRole("region", { name: "Recent games", exact: true });
    await expect(recentGames.locator(".game-library-item")).toHaveCount(1);
    await expect(recentGames).toContainText(username);
    await device.getByRole("link", { name: "Settings", exact: true }).click();
    await device.getByText("Change Chess.com connection", { exact: true }).click();
    await expect(device.getByLabel("Remembered Chess.com username")).toHaveValue(username);
    await settingsSection(device, "Coach & animations");
    await expect(device.getByLabel("Coach motion", { exact: true })).toHaveValue("still");
    await expect(device.getByLabel("Piece & interface motion", { exact: true })).toHaveValue(
      "natural",
    );
    await expect(device.getByRole("radio")).toHaveCount(30);
    await expect(device.getByRole("radio", { name: "Ingrid", exact: true })).toBeChecked();
    await expect(device.getByLabel("Coach motion", { exact: true })).toBeEnabled();
    await settingsSection(device, "Sound");
    const deviceSound = device.getByRole("region", { name: "Sound", exact: true });
    await expect(deviceSound.getByRole("checkbox", { name: /^Board moves/ })).not.toBeChecked();
    await expect(deviceSound.getByRole("checkbox", { name: /^Practice feedback/ })).toBeChecked();
    await expect(deviceSound.getByLabel("Coach voice", { exact: true })).toHaveValue("manual");
    await device.reload();
    await expect(deviceSound.getByLabel("Coach voice", { exact: true })).toHaveValue("manual");
    await expect(deviceSound.getByRole("checkbox", { name: /^Review accents/ })).toHaveCount(0);
    await expect(
      deviceSound.getByRole("button", { name: "Test sound", exact: true }),
    ).toBeDisabled();
    await expect(device.getByRole("region", { name: "Account", exact: true })).toHaveCount(0);
    await settingsSection(device, "Account");
    await expect(device).toHaveURL("/settings?section=account");
    await expect(device.getByRole("radio")).toHaveCount(0);
    await expect(device.getByRole("region", { name: "Account", exact: true })).toContainText(
      `Signed in as ${username}`,
    );
    await device.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.reload();
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await settingsSection(page, "Account");
    const account = page.getByRole("region", { name: "Account", exact: true });
    await expect(account).toContainText(`Signed in as ${username}`);
    await expect(
      account.getByRole("button", { name: "Sign out all devices", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/account-settings-${info.project.name}.png`,
      fullPage: true,
    });
    await device.getByRole("button", { name: "New here? Create an account" }).click();
    await device.getByLabel("Username", { exact: true }).fill(`${username}-other`);
    await device.getByLabel("Password", { exact: true }).fill("test-only-password");
    await submitSignup(device);
    await device.getByRole("button", { name: "Continue", exact: true }).click();
    await device.getByRole("button", { name: "Finish for now", exact: true }).click();
    await device.getByRole("link", { name: "Home", exact: true }).click();
    await expect(
      recentGames.getByText("Your next insight starts with a game.", { exact: true }),
    ).toBeVisible();
    await expect(recentGames.locator(".game-library-item")).toHaveCount(0);
    await expect(recentGames).not.toContainText(username);
    await device.getByRole("link", { name: "Settings", exact: true }).click();
    await settingsSection(device, "Coach & animations");
    await expect(device.getByLabel("Coach motion", { exact: true })).toBeEnabled();
    await expect(device.getByLabel("Coach motion", { exact: true })).toHaveValue("system");
    await expect(device.getByLabel("Piece & interface motion", { exact: true })).toHaveValue(
      "system",
    );
    await expect(device.getByRole("radio", { name: "Walter", exact: true })).toBeChecked();
    await settingsSection(device, "Sound");
    await expect(deviceSound.getByRole("checkbox", { name: /^Board moves/ })).toBeChecked();
    await expect(deviceSound.getByRole("checkbox", { name: /^Practice feedback/ })).toBeChecked();
    await expect(deviceSound.getByLabel("Coach voice", { exact: true })).toHaveValue("automatic");
    await expect(deviceSound.getByRole("checkbox", { name: /^Review accents/ })).toHaveCount(0);
    await expect(
      deviceSound.getByRole("button", { name: "Unmute this device", exact: true }),
    ).toHaveCount(0);
    // Replacing the signed-in account also replaces its muted audio provider.
    await deviceSound.getByRole("button", { name: "Test sound", exact: true }).click();
    await expect.poll(() => audioCues(device)).toEqual(["move"]);
    expect(await (await device.request.get("/api/preferences/audio")).json()).toEqual({
      enabled: true,
      volume: 0.35,
      board: true,
      practice: true,
      voice: "automatic",
    });
    await device.getByRole("link", { name: "Games", exact: true }).click();
    await expect(device.locator(".game-library-item")).toHaveCount(0);
    await expect(device.getByLabel("Remembered Chess.com username")).toHaveCount(0);
    await device.getByRole("link", { name: "Import games in Settings", exact: true }).click();
    await expect(device.getByLabel("Remembered Chess.com username")).toHaveValue("");
    // Another account can open the shared link read-only, but never gains the game.
    await device.goto(`${gameHref}?ply=3`);
    await expect(device.locator(".game-player-name", { hasText: username })).toBeVisible();
    await expect(device.getByRole("button", { name: /review$/ })).toHaveCount(0);
    await device.getByRole("link", { name: "Games", exact: true }).click();
    await expect(device.locator(".game-library-item")).toHaveCount(0);
  } finally {
    await second.close();
  }
  secondErrors.check();
});

test("one-time onboarding allows no usernames, then saves both providers and explains fetching", async ({
  page,
}, info) => {
  const username = `welcome-${info.project.name}`;
  await page.goto("/");
  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await submitSignup(page);
  await expect(page.getByRole("heading", { name: "Where do you play?" })).toBeVisible();
  // Usernames are optional: continuing without them explains PGN import.
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bring in your first games" })).toBeVisible();
  await expect(page.getByText("No connected account needed.", { exact: false })).toBeVisible();
  expect((await (await page.request.get("/api/auth/me")).json()).user.onboarding_completed).toBe(
    false,
  );
  expect(await (await page.request.get("/api/jobs")).json()).toEqual([]);
  // An interrupted welcome resumes with saved choices, without starting analysis.
  await page.reload();
  await expect(page.getByLabel("Chess.com username (optional)", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Lichess username (optional)", { exact: true })).toHaveValue("");
  await page.getByLabel("Chess.com username (optional)", { exact: true }).fill(username);
  await page.getByLabel("Lichess username (optional)", { exact: true }).fill(`${username}-li`);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Your Chess.com and Lichess usernames are saved.")).toBeVisible();
  expect(await (await page.request.get("/api/jobs")).json()).toEqual([]);
  await page.reload();
  await expect(page.getByLabel("Chess.com username (optional)", { exact: true })).toHaveValue(
    username,
  );
  await expect(page.getByLabel("Lichess username (optional)", { exact: true })).toHaveValue(
    `${username}-li`,
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Your Chess.com and Lichess usernames are saved.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `account-test-results/onboarding-${info.project.name}.png`,
    fullPage: true,
  });
  await page.route("**/api/auth/onboarding/complete", route =>
    route.fulfill({ status: 503, json: { detail: "Please retry completion." } }),
  );
  await page.getByRole("button", { name: "Open imports", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Please retry completion.");
  expect((await (await page.request.get("/api/auth/me")).json()).user.onboarding_completed).toBe(
    false,
  );
  await page.unroute("**/api/auth/onboarding/complete");
  await page.getByRole("button", { name: "Open imports", exact: true }).click();
  await expect(page).toHaveURL("/settings?import=chesscom");
  await expect(
    page.getByRole("heading", { name: "Import from Chess.com", exact: true }),
  ).toBeVisible();
  expect((await (await page.request.get("/api/auth/me")).json()).user.onboarding_completed).toBe(
    true,
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Where do you play?" })).toHaveCount(0);
});
