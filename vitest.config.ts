import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "./test/runMain.ts",
    include: ["**/*.test.ts"],
  },
});
