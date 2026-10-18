import { expect, test } from "./helpers/browserTest";

test("current application errors remain alerts and their shared action dismisses them", async ({
  page,
}) => {
  // Activity loads, then a later refresh fails: the outage is a page banner, once.
  let reads = 0;
  await page.route("**/api/jobs", route => {
    if (++reads >= 2)
      return route.fulfill({
        status: 503,
        json: { detail: "Import activity could not be loaded." },
      });
    return route.fulfill({ json: [] });
  });
  await page.goto("/settings");
  const notice = page.getByRole("alert").filter({ hasText: "Couldn’t refresh import activity." });
  // A short-lived error is a banner in the page's one banner slot.
  await expect(notice).toHaveClass(/notice--banner/);
  await expect(page.getByRole("region", { name: "Notifications" })).toContainText(
    "Couldn’t refresh import activity.",
  );
  await expect(notice).toHaveAttribute("data-tone", "error");
  await expect(notice).toHaveAttribute("aria-atomic", "true");
  const dismiss = notice.getByRole("button", { name: "Dismiss", exact: true });
  await expect(dismiss).toBeVisible();
  await dismiss.focus();
  await page.keyboard.press("Enter");
  await expect(notice).toHaveCount(0);
  // Later failed reads in the same outage stay quiet once it was dismissed.
  await expect.poll(() => reads).toBeGreaterThan(2);
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
});

test("account form failures use the same alert without changing form behavior", async ({
  page,
}) => {
  await page.route("**/api/auth/me", route =>
    route.fulfill({ json: { enabled: true, user: null } }),
  );
  await page.route("**/api/auth/login", route =>
    route.fulfill({ status: 401, json: { detail: "The username or password was incorrect." } }),
  );
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("notice-account");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const notice = page
    .getByRole("alert")
    .filter({ hasText: "The username or password was incorrect." });
  await expect(notice).toHaveClass(/notice--panel/);
  await expect(notice).toHaveAttribute("data-tone", "error");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue("notice-account");
});
