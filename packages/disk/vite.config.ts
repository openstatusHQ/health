import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: "src/mod.ts",
    dts: { sourcemap: true },
    format: ["esm", "cjs"],
    fixedExtension: false,
    platform: "node",
    unbundle: true,
  },
});
