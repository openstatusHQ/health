import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { type MysqlLikeClient, mysqlProbe } from "./mod.ts";

function fakeClient(
  calls: string[],
  result: () => Promise<void> = () => Promise.resolve(),
): MysqlLikeClient {
  return {
    query: (sql) => {
      calls.push(sql);
      return result();
    },
  };
}

test("mysqlProbe() runs select 1 through query()", async () => {
  const calls: string[] = [];
  const report = await runProbes([mysqlProbe({ client: fakeClient(calls) })]);
  assert.deepEqual(calls, ["select 1"]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "database");
  assert.equal(report.checks[0].critical, true);
});

test("mysqlProbe() reports unhealthy when the query rejects", async () => {
  const client = fakeClient(
    [],
    () => Promise.reject(new Error("ER_ACCESS_DENIED_ERROR")),
  );
  const report = await runProbes([mysqlProbe({ client })], {
    formatError: "message",
  });
  assert.equal(report.status, "unhealthy");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "ER_ACCESS_DENIED_ERROR");
});

test("mysqlProbe() fails when query() is the callback API", async () => {
  const client = {
    query: () => ({ sql: "select 1" }),
  } as unknown as MysqlLikeClient;
  const report = await runProbes([mysqlProbe({ client })], {
    formatError: "message",
  });
  assert.equal(report.checks[0].status, "failed");
  assert.match(report.checks[0].error ?? "", /mysql2\/promise/);
});

test("mysqlProbe() times out on a hanging query", async () => {
  const client: MysqlLikeClient = { query: () => new Promise(() => {}) };
  const report = await runProbes([mysqlProbe({ client, timeoutMs: 20 })]);
  assert.equal(report.checks[0].status, "timeout");
});

test("mysqlProbe() throws at construction without query()", () => {
  assert.throws(
    () => mysqlProbe({ client: {} as MysqlLikeClient }),
    /mysqlProbe: "client" must expose query\(\), got an object with no keys/,
  );
  assert.throws(
    () => mysqlProbe({ client: { end: 1 } as unknown as MysqlLikeClient }),
    /got an object with keys end/,
  );
  assert.throws(
    () => mysqlProbe({ client: undefined as unknown as MysqlLikeClient }),
    /got undefined/,
  );
});

test("mysqlProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    mysqlProbe({
      client: fakeClient(calls),
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
