import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/mod.ts", "src/testing.ts"],
    dts: { sourcemap: true },
    format: ["esm", "cjs"],
    fixedExtension: false,
    platform: "neutral",
    unbundle: true,
  },
});
