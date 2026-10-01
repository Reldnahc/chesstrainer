import { expect, type Page } from "@playwright/test";
import path from "node:path";
import { viteFsPath } from "../../studio-tests/helpers/viteFsPath";
import type { WalterStudioOptions } from "./WalterStudioHarness";

/** Keep Vite's module graph without mounting an unrelated player or portrait. */
export async function openAudioFixturePage(page: Page) {
  await page.route(url => url.pathname === "/", route => route.fulfill({
    contentType: "text/html", body: `<!doctype html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script type="module">
        import { injectIntoGlobalHook } from '/@react-refresh';
        injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => (type) => type;
      </script></head><body></body></html>`,
  }));
  await page.goto("/");
  await loadFixtureStyles(page);
}

async function loadFixtureStyles(page: Page) {
  await page.evaluate(async root => {
    await import(`${root}/src/foundation.css`);
    await import(`${root}/src/interface-motion.css`);
  }, viteFsPath(path.resolve(".")));
}

export async function mountWalterStudio(page: Page, options: WalterStudioOptions = {}) {
  await loadFixtureStyles(page);
  await page.evaluate(async ({root, options}) => {
    const {mountWalterStudio} = await import(`${root}/audio-tests/fixtures/WalterStudioHarness.tsx`);
    mountWalterStudio(options);
  }, {root: viteFsPath(path.resolve(".")), options});
  await expect(page.getByRole("region", {name: "Find Walter’s voice", exact: true})).toBeVisible();
}

export async function openWalterStudio(page: Page, options: WalterStudioOptions = {}) {
  await openAudioFixturePage(page);
  await mountWalterStudio(page, options);
}
