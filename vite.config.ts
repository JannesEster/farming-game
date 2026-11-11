import { defineConfig } from "vitest/config";

function siteBase(): string {
  const raw = process.env.VITE_BASE?.trim();
  if (!raw) return "/farming-game/";
  if (raw === "/" || raw === "./") return raw;
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export default defineConfig({
  base: siteBase(),
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
