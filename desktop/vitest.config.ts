import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure TS helpers land in later tasks; scaffold should not fail CI/local smoke.
    passWithNoTests: true,
  },
});
