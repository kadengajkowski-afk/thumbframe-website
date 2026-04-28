import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// NOTE: this file is ESM (package.json "type": "module"), so __dirname is
// undefined. Use fileURLToPath(import.meta.url) to resolve the config dir.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  // Day 18 fix — @jsquash/jpeg + @jsquash/png ship emscripten glue
  // that loads .wasm files via import.meta.url. When Vite optimizes
  // these into the dep cache, that URL no longer resolves to the
  // original .wasm location and dev returns the SPA fallback
  // (index.html) instead — the WASM compile then chokes on "<!do".
  // Excluding them from optimizeDeps keeps the original module
  // structure so we can drive WASM loading manually via ?url.
  optimizeDeps: {
    exclude: ["@jsquash/jpeg", "@jsquash/png"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
  },
});
