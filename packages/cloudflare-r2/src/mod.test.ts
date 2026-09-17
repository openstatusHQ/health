import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { type R2LikeBucket, r2Probe } from "./mod.ts";

function fakeBucket(
  calls: string[],
  result: () => Promise<object | null> = () => Promise.resolve(null),
): R2LikeBucket {
  return {
    head: (key) => {
      calls.push(key);
      return result();
    },
  };
}

test("r2Probe() heads the default key and passes on a miss", async () => {
  const calls: string[] = [];
  const report = await runProbes([r2Probe({ bucket: fakeBucket(calls) })]);
  assert.deepEqual(calls, ["health"]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "storage");
  assert.equal(report.checks[0].critical, false);
});

test("r2Probe() honours the key option", async () => {
  const calls: string[] = [];
  await runProbes([r2Probe({ bucket: fakeBucket(calls), key: "logo.png" })]);
  assert.deepEqual(calls, ["logo.png"]);
});

test("r2Probe() reports degraded when head() rejects", async () => {
  const bucket = fakeBucket(
    [],
    () => Promise.reject(new Error("R2 head failed: 10001 internal error")),
  );
  const report = await runProbes([r2Probe({ bucket })], {
    formatError: "message",
  });
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "R2 head failed: 10001 internal error");
});

test("r2Probe() makes the report unhealthy when critical", async () => {
  const bucket = fakeBucket([], () => Promise.reject(new Error("down")));
  const report = await runProbes([r2Probe({ bucket, critical: true })]);
  assert.equal(report.status, "unhealthy");
});

test("r2Probe() times out on a hanging head", async () => {
  const bucket: R2LikeBucket = { head: () => new Promise(() => {}) };
  const report = await runProbes([r2Probe({ bucket, timeoutMs: 20 })]);
  assert.equal(report.checks[0].status, "timeout");
});

test("r2Probe() throws at construction on an invalid bucket or key", () => {
  assert.throws(
    () => r2Probe({ bucket: {} as R2LikeBucket }),
    /r2Probe: "bucket" must expose head\(\), got an object with no keys/,
  );
  assert.throws(
    () => r2Probe({ bucket: undefined as unknown as R2LikeBucket }),
    /got undefined/,
  );
  assert.throws(
    () => r2Probe({ bucket: fakeBucket([]), key: "" }),
    /r2Probe: "key" must not be empty/,
  );
});

test("r2Probe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    r2Probe({
      bucket: fakeBucket(calls),
      name: "uploads",
      critical: true,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "uploads");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.deepEqual(calls, []);
});
