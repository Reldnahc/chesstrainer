import { defineConfig, devices } from "@playwright/test";
import { balancedShardFiles, studioTimeout, studioWorkers } from "./playwright.shared";

export default defineConfig({
  testDir: "./studio-tests",
  outputDir: "./studio-test-results",
  workers: studioWorkers, fullyParallel: true, timeout: studioTimeout,
  // The full-cast file alone outweighs the rest, so an even split by test count left
  // one CI shard three times longer than its siblings. Balance whole files by duration.
  ...((files) => files ? { testMatch: files } : {})(balancedShardFiles("studio-tests")),
  use: { baseURL: "http://127.0.0.1:5174", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1100 } },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npm run dev:coach",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
  },
});
