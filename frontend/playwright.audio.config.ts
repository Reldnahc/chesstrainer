import { defineConfig, devices } from "@playwright/test";
import { parseShard, studioTimeout, studioWorkers } from "./playwright.shared";

export default defineConfig({
  testDir: "./audio-tests",
  outputDir: "./audio-test-results",
  workers: studioWorkers, fullyParallel: true, timeout: studioTimeout, shard: parseShard(),
  use: { baseURL: "http://127.0.0.1:5176", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1050 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: { command: "npm run dev:audio", url: "http://127.0.0.1:5176", reuseExistingServer: false },
});
