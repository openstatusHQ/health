import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const packages = fileURLToPath(new URL("./packages/", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@openstatus\/health$/,
        replacement: `${packages}health/src/mod.ts`,
      },
      {
        find: /^@openstatus\/health\/testing$/,
        replacement: `${packages}health/src/testing.ts`,
      },
      {
        find: /^@openstatus\/health-(.+)$/,
        replacement: `${packages}$1/src/mod.ts`,
      },
    ],
  },
  test: {
    include: ["packages/*/src/**/*.test.ts"],
  },
  lint: {
    ignorePatterns: ["**/dist/**", "coverage/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    overrides: [
      {
        files: ["**/*.test.ts"],
        rules: {
          "no-unused-expressions": "off",
          "typescript/no-base-to-string": "off",
          "unicorn/no-thenable": "off",
        },
      },
    ],
  },
  fmt: {
    printWidth: 80,
    ignorePatterns: ["**/dist/**", "coverage/**", "**/*.md"],
  },
});
