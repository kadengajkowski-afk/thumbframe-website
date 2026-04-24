import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath, URL } from "node:url";

// Browser-mode Vitest via Playwright/Chromium. Integration tests run
// against a real PixiJS Application with WebGL — per CLAUDE.md:
// "NEVER mock PixiJS or Zustand". Boots a headless Chromium per run.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});
