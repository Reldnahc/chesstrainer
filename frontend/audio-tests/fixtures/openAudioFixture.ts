import type { Page } from "@playwright/test";
import path from "node:path";
import { viteFsPath } from "../../studio-tests/helpers/viteFsPath";

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
