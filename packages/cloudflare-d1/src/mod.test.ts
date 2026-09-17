import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { type D1LikeDatabase, d1Probe } from "./mod.ts";

function fakeDb(
  calls: string[],
  result: () => Promise<void> = () => Promise.resolve(),
): D1LikeDatabase {
  return {
    prepare: (query) => ({
      first: () => {
        calls.push(query);
        return result();
      },
    }),
  };
}

test("d1Probe() runs select 1 through prepare().first()", async () => {
  const calls: string[] = [];
  const report = await runProbes([d1Probe({ db: fakeDb(calls) })]);
  assert.deepEqual(calls, ["select 1"]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "database");
  assert.equal(report.checks[0].critical, true);
});

test("d1Probe() reports unhealthy when the statement rejects", async () => {
  const db = fakeDb([], () => Promise.reject(new Error("D1_ERROR")));
  const report = await runProbes([d1Probe({ db })], {
    formatError: "message",
  });
  assert.equal(report.status, "unhealthy");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "D1_ERROR");
});

test("d1Probe() times out on a hanging statement", async () => {
  const db: D1LikeDatabase = {
    prepare: () => ({ first: () => new Promise(() => {}) }),
  };
  const report = await runProbes([d1Probe({ db, timeoutMs: 20 })]);
  assert.equal(report.checks[0].status, "timeout");
});

test("d1Probe() throws at construction without prepare()", () => {
  assert.throws(
    () => d1Probe({ db: {} as D1LikeDatabase }),
    /d1Probe: "db" must expose prepare\(\), got an object with no keys/,
  );
  assert.throws(
    () => d1Probe({ db: { batch: 1 } as unknown as D1LikeDatabase }),
    /got an object with keys batch/,
  );
  assert.throws(
    () => d1Probe({ db: undefined as unknown as D1LikeDatabase }),
    /got undefined/,
  );
});

test("d1Probe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    d1Probe({
      db: fakeDb(calls),
      name: "d1",
      critical: false,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "d1");
  assert.equal(check.critical, false);
  assert.equal(check.status, "skipped");
  assert.deepEqual(calls, []);
});
