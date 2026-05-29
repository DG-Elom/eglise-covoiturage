import { defineConfig, devices } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const PORT = 3201;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
const isCI = !!process.env.CI;
const isLocalTarget = baseURL.startsWith("http://localhost");

// Charge .env.test pour injecter les variables dans le webServer Next.js.
// (Next.js lit .env.local en priorité ; en CI le .env.local prod n'existe pas,
//  on injecte donc les vars local Supabase directement via webServer.env.)
function loadEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return result;
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    result[key] = value;
  }
  return result;
}

const envTest = loadEnvFile(path.resolve(__dirname, ".env.test"));

// Variables injectées dans le webServer : .env.test sert de base,
// les variables déjà présentes dans process.env (ex: CI) ont la priorité.
const webServerEnv: Record<string, string> = {
  ...envTest,
  ...Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]
  ),
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: isLocalTarget
    ? {
        command: `npm run dev -- -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
        env: webServerEnv,
      }
    : undefined,
});
