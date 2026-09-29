import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: { environment: "node", include: ["lib/**/*.test.ts", "packages/druto-sdk/src/**/*.test.ts"] },
});
