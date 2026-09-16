import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { type KVLikeNamespace, kvProbe } from "./mod.ts";

function fakeNamespace(
  calls: string[],
  result: () => Promise<string | null> = () => Promise.resolve(null),
): KVLikeNamespace {
  return {
    get: (key) => {
      calls.push(key);
      return result();
    },
  };
}

test("kvProbe() reads the default key and passes on a miss", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    kvProbe({ namespace: fakeNamespace(calls) }),
  ]);
  assert.deepEqual(calls, ["health"]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "kv");
  assert.equal(report.checks[0].critical, false);
});

test("kvProbe() honours the key option", async () => {
  const calls: string[] = [];
  await runProbes([kvProbe({ namespace: fakeNamespace(calls), key: "ping" })]);
  assert.deepEqual(calls, ["ping"]);
});

test("kvProbe() reports degraded when get() rejects", async () => {
  const namespace = fakeNamespace(
    [],
    () => Promise.reject(new Error("KV GET failed: 500 Internal Server Error")),
  );
  const report = await runProbes([kvProbe({ namespace })], {
    formatError: "message",
  });
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(
    report.checks[0].error,
    "KV GET failed: 500 Internal Server Error",
  );
});

test("kvProbe() makes the report unhealthy when critical", async () => {
  const namespace = fakeNamespace([], () => Promise.reject(new Error("down")));
  const report = await runProbes([kvProbe({ namespace, critical: true })]);
  assert.equal(report.status, "unhealthy");
});

test("kvProbe() times out on a hanging read", async () => {
  const namespace: KVLikeNamespace = { get: () => new Promise(() => {}) };
  const report = await runProbes([kvProbe({ namespace, timeoutMs: 20 })]);
  assert.equal(report.checks[0].status, "timeout");
});

test("kvProbe() throws at construction on an invalid namespace or key", () => {
  assert.throws(
    () => kvProbe({ namespace: {} as KVLikeNamespace }),
    /kvProbe: "namespace" must expose get\(\), got an object with no keys/,
  );
  assert.throws(
    () => kvProbe({ namespace: undefined as unknown as KVLikeNamespace }),
    /got undefined/,
  );
  assert.throws(
    () => kvProbe({ namespace: fakeNamespace([]), key: "" }),
    /kvProbe: "key" must not be empty/,
  );
});

test("kvProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    kvProbe({
      namespace: fakeNamespace(calls),
      name: "sessions",
      critical: true,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "sessions");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.deepEqual(calls, []);
});
