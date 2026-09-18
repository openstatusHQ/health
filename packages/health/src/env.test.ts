import assert from "node:assert/strict";
import test from "node:test";
import { readEnv, readEnvCount, readEnvText } from "./env.ts";

type ProcessLike = { env?: Readonly<Record<string, string | undefined>> };

const missing = "OPENSTATUS_HEALTH_TEST_MISSING";

function withProcess(replacement: ProcessLike | undefined, run: () => void) {
  const runtime = globalThis as { process?: ProcessLike };
  const original = runtime.process;
  if (replacement == null) delete runtime.process;
  else runtime.process = replacement;
  try {
    run();
  } finally {
    runtime.process = original;
  }
}

test("readEnv() prefers an explicit source", () => {
  withProcess({ env: { TOKEN: "from-process" } }, () => {
    assert.equal(readEnv("TOKEN", { TOKEN: "from-source" }), "from-source");
  });
});

test("readEnv() returns undefined for a name missing from the source", () => {
  assert.equal(readEnv(missing, {}), undefined);
});

test("readEnv() falls back to process.env", () => {
  withProcess({ env: { TOKEN: "from-process" } }, () => {
    assert.equal(readEnv("TOKEN"), "from-process");
  });
});

test("readEnv() returns undefined when process is absent", () => {
  withProcess(undefined, () => {
    assert.equal(readEnv(missing), undefined);
  });
});

test("readEnv() returns undefined when reading process.env throws", () => {
  const throwing: ProcessLike = {
    get env(): Readonly<Record<string, string | undefined>> {
      throw new Error("NotCapable");
    },
  };
  withProcess(throwing, () => {
    assert.equal(readEnv(missing), undefined);
  });
});

test("readEnv() falls back to Deno.env when process is absent", {
  skip: typeof Deno === "undefined",
}, () => {
  Deno.env.set(missing, "from-deno");
  try {
    withProcess(undefined, () => {
      assert.equal(readEnv(missing), "from-deno");
    });
  } finally {
    Deno.env.delete(missing);
  }
});

test("readEnvText() returns the value and drops empty strings", () => {
  assert.equal(readEnvText("TOKEN", { TOKEN: "secret" }), "secret");
  assert.equal(readEnvText("TOKEN", { TOKEN: "" }), undefined);
  assert.equal(readEnvText(missing, {}), undefined);
});

test("readEnvCount() parses finite numbers and rejects the rest", () => {
  assert.equal(readEnvCount("MEMORY", { MEMORY: "256" }), 256);
  assert.equal(readEnvCount("MEMORY", { MEMORY: "0" }), 0);
  assert.equal(readEnvCount("MEMORY", { MEMORY: "lots" }), undefined);
  assert.equal(readEnvCount("MEMORY", { MEMORY: "" }), undefined);
  assert.equal(readEnvCount(missing, {}), undefined);
});
