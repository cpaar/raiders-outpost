import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4000",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    env: { EXPEDITION_RESET_NOW: process.env.EXPEDITION_RESET_NOW ?? "2026-03-02T12:00:00.000Z" },
    url: "http://127.0.0.1:4000",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
