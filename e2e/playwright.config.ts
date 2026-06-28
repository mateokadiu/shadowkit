import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // No retries locally — flake means broken test, not "click again."
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    headless: true,
    // Static fixtures live under e2e/fixtures and load over the file://
    // protocol; the harness doesn't need a server for the v1.0 surface.
    baseURL: undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
