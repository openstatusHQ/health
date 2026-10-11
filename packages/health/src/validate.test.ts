import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { DuplicateProbeError } from "./errors.ts";
import { assertUniqueProbeNames } from "./validate.ts";

test("assertUniqueProbeNames() accepts unique names", () => {
  assertUniqueProbeNames([
    { name: "a", run: () => {} },
    {
      name: "b",
      run: () => {},
    },
  ]);
});

test("assertUniqueProbeNames() throws on duplicates", () => {
  assert.throws(
    () =>
      assertUniqueProbeNames([
        { name: "a", run: () => {} },
        {
          name: "a",
          run: () => {},
        },
      ]),
    (e: Error) => e instanceof DuplicateProbeError && e.probeName === "a",
  );
});

test("DuplicateProbeError suggests the fix", () => {
  assert.throws(
    () =>
      assertUniqueProbeNames([
        { name: "database", run: () => {} },
        { name: "database", run: () => {} },
      ]),
    /duplicate probe name "database": pass a different `name` to one of the probes/,
  );
});
