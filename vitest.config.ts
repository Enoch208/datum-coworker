import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "core",
          root: "packages/core",
          include: ["tests/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "masumi",
          root: "packages/masumi",
          include: ["tests/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "api",
          root: "apps/api",
          include: ["tests/**/*.test.ts"],
          environment: "node",
          fileParallelism: false,
          testTimeout: 30_000,
          env: {
            DATABASE_URL: "postgres://datum:datum@localhost:54330/datum_test",
          },
        },
      },
    ],
  },
});
