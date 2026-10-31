import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` throws when imported outside a React Server environment;
      // in unit tests we replace it with an empty module.
      "server-only": fileURLToPath(new URL("./tests/empty-module.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx,mts}"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
