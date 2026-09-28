import {defineConfig, devices} from "@playwright/test";
export default defineConfig({
  testDir: "./intelligence-tests", outputDir: "./intelligence-test-results", workers: 1,
  use: {baseURL: "http://127.0.0.1:5175", trace: "retain-on-failure"},
  projects: [
    {name: "desktop", use: {...devices["Desktop Chrome"], viewport: {width: 1440, height: 1000}}},
    {name: "mobile", use: {...devices["iPhone 13"], defaultBrowserType: "chromium"}},
  ],
  webServer: {command: "npm run dev:intelligence", url: "http://127.0.0.1:5175", reuseExistingServer: false},
});
