import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { type NeonLikeClient, neonProbe } from "./mod.ts";

function fakeClient(
  calls: string[],
  result: () => Promise<void> = () => Promise.resolve(),
): NeonLikeClient {
  return {
    query: (text) => {
      calls.push(text);
      return result();
    },
  };
}

function fakeSqlFunction(calls: string[]): NeonLikeClient {
  const sql = () => Promise.resolve([]);
  sql.query = (text: string) => {
    calls.push(text);
    return Promise.resolve([]);
  };
  return sql;
}

test("neonProbe() runs select 1 through query()", async () => {
  const calls: string[] = [];
  const report = await runProbes([neonProbe({ client: fakeClient(calls) })]);
  assert.deepEqual(calls, ["select 1"]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "database");
  assert.equal(report.checks[0].critical, true);
});

test("neonProbe() accepts the callable sql function from neon()", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    neonProbe({ client: fakeSqlFunction(calls) }),
  ]);
  assert.deepEqual(calls, ["select 1"]);
  assert.equal(report.status, "ok");
});

test("neonProbe() reports unhealthy when the query rejects", async () => {
  const client = fakeClient(
    [],
    () => Promise.reject(new Error("password authentication failed")),
  );
  const report = await runProbes([neonProbe({ client })], {
    formatError: "message",
  });
  assert.equal(report.status, "unhealthy");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "password authentication failed");
});

test("neonProbe() times out on a hanging query", async () => {
  const client: NeonLikeClient = { query: () => new Promise(() => {}) };
  const report = await runProbes([neonProbe({ client, timeoutMs: 20 })]);
  assert.equal(report.checks[0].status, "timeout");
});

test("neonProbe() throws at construction without query()", () => {
  assert.throws(
    () => neonProbe({ client: {} as NeonLikeClient }),
    /neonProbe: "client" must expose query\(\), got an object with no keys/,
  );
  assert.throws(
    () => neonProbe({ client: (() => {}) as unknown as NeonLikeClient }),
    /got a function with no keys/,
  );
  assert.throws(
    () => neonProbe({ client: undefined as unknown as NeonLikeClient }),
    /got undefined/,
  );
});

test("neonProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    neonProbe({
      client: fakeClient(calls),
      name: "neon",
      critical: false,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "neon");
  assert.equal(check.critical, false);
  assert.equal(check.status, "skipped");
  assert.deepEqual(calls, []);
});
