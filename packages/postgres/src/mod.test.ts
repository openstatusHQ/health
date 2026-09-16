import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { type PostgresLikeClient, postgresProbe } from "./mod.ts";

function queryClient(
  calls: string[],
  result: () => Promise<void> = () => Promise.resolve(),
): PostgresLikeClient {
  return {
    query: (text) => {
      calls.push(`query ${text}`);
      return result();
    },
  };
}

function unsafeClient(calls: string[]): PostgresLikeClient {
  return {
    unsafe: (text) => {
      calls.push(`unsafe ${text}`);
      return Promise.resolve([]);
    },
  };
}

test("postgresProbe() runs select 1 through query()", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    postgresProbe({ client: queryClient(calls) }),
  ]);
  assert.deepEqual(calls, ["query select 1"]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "database");
  assert.equal(report.checks[0].critical, true);
});

test("postgresProbe() falls back to unsafe() for postgres.js", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    postgresProbe({ client: unsafeClient(calls) }),
  ]);
  assert.deepEqual(calls, ["unsafe select 1"]);
  assert.equal(report.status, "ok");
});

test("postgresProbe() prefers query() when both exist", async () => {
  const calls: string[] = [];
  const client: PostgresLikeClient = {
    ...queryClient(calls),
    ...unsafeClient(calls),
  };
  await runProbes([postgresProbe({ client })]);
  assert.deepEqual(calls, ["query select 1"]);
});

test("postgresProbe() reports unhealthy when the query rejects", async () => {
  const client = queryClient(
    [],
    () => Promise.reject(new Error("connect ECONNREFUSED")),
  );
  const report = await runProbes([postgresProbe({ client })], {
    formatError: "message",
  });
  assert.equal(report.status, "unhealthy");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "connect ECONNREFUSED");
});

test("postgresProbe() times out on a hanging query", async () => {
  const client: PostgresLikeClient = { query: () => new Promise(() => {}) };
  const report = await runProbes([postgresProbe({ client, timeoutMs: 20 })]);
  assert.equal(report.checks[0].status, "timeout");
});

test("postgresProbe() throws at construction without query() or unsafe()", () => {
  assert.throws(
    () => postgresProbe({ client: {} }),
    /postgresProbe: "client" must expose query\(\) or unsafe\(\), got an object with no keys/,
  );
  assert.throws(
    () =>
      postgresProbe({ client: { end: 1 } as unknown as PostgresLikeClient }),
    /got an object with keys end/,
  );
  assert.throws(
    () => postgresProbe({ client: undefined as unknown as PostgresLikeClient }),
    /got undefined/,
  );
});

test("postgresProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    postgresProbe({
      client: queryClient(calls),
      name: "primary",
      critical: false,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "primary");
  assert.equal(check.critical, false);
  assert.equal(check.status, "skipped");
  assert.deepEqual(calls, []);
});
