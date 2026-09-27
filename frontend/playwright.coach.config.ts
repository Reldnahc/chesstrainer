import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./studio-tests",
  outputDir: "./studio-test-results",
  workers: 1,
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
