import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { type LibsqlLikeClient, tursoProbe } from "./mod.ts";

interface FakeLibsql {
  readonly calls: string[];
  readonly reject?: boolean;
}

function fakeClient(options: FakeLibsql = { calls: [] }): {
  client: LibsqlLikeClient;
} {
  return {
    client: {
      execute: (sql: string) => {
        options.calls.push(sql);
        if (options.reject) return Promise.reject(new Error("boom"));
        return Promise.resolve({ rows: [{ 1: 1 }] });
      },
    },
  };
}

test("tursoProbe() executes select 1", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    tursoProbe({ client: fakeClient({ calls }).client }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].status, "ok");
  assert.deepEqual(calls, ["select 1"]);
});

test("tursoProbe() defaults to critical with the name database", async () => {
  const report = await runProbes([
    tursoProbe({ client: fakeClient().client }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "database");
  assert.equal(check.critical, true);
});

test("tursoProbe() reports unhealthy on a rejection", async () => {
  const report = await runProbes([
    tursoProbe({ client: fakeClient({ calls: [], reject: true }).client }),
  ]);
  assert.equal(report.status, "unhealthy");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("tursoProbe() honours name, critical and skip overrides", async () => {
  const report = await runProbes([
    tursoProbe({
      client: fakeClient().client,
      name: "turso",
      critical: false,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "turso");
  assert.equal(check.critical, false);
  assert.equal(check.status, "skipped");
});

test("tursoProbe() throws at construction without execute()", () => {
  assert.throws(
    () => tursoProbe({ client: {} as LibsqlLikeClient }),
    /tursoProbe: "client" must expose execute\(\), got an object with no keys/,
  );
  assert.throws(
    () => tursoProbe({ client: { query: 1 } as unknown as LibsqlLikeClient }),
    /got an object with keys query/,
  );
  assert.throws(
    () => tursoProbe({ client: undefined as unknown as LibsqlLikeClient }),
    /got undefined/,
  );
});
