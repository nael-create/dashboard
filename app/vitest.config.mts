import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@config": path.resolve(here, "dashboard.config.ts"),
      "@": path.resolve(here, "src"),
    },
  },
  test: { include: ["test/**/*.test.ts"] },
});
