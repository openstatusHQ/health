import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { type TursoServerlessConnection, tursoServerlessProbe } from "./mod.ts";

interface FakeConnection {
  readonly calls: string[];
  readonly reject?: boolean;
}

function fakeConnection(
  options: FakeConnection = { calls: [] },
): TursoServerlessConnection {
  return {
    get: (sql: string) => {
      options.calls.push(sql);
      if (options.reject) return Promise.reject(new Error("boom"));
      return Promise.resolve({ 1: 1 });
    },
  };
}

test("tursoServerlessProbe() selects 1", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    tursoServerlessProbe({ connection: fakeConnection({ calls }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].status, "ok");
  assert.deepEqual(calls, ["select 1"]);
});

test("tursoServerlessProbe() defaults to critical with the name database", async () => {
  const report = await runProbes([
    tursoServerlessProbe({ connection: fakeConnection() }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "database");
  assert.equal(check.critical, true);
});

test("tursoServerlessProbe() reports unhealthy on a rejection", async () => {
  const report = await runProbes([
    tursoServerlessProbe({
      connection: fakeConnection({ calls: [], reject: true }),
    }),
  ]);
  assert.equal(report.status, "unhealthy");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("tursoServerlessProbe() honours name, critical and skip overrides", async () => {
  const report = await runProbes([
    tursoServerlessProbe({
      connection: fakeConnection(),
      name: "turso-edge",
      critical: false,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "turso-edge");
  assert.equal(check.critical, false);
  assert.equal(check.status, "skipped");
});

test("tursoServerlessProbe() throws at construction without get()", () => {
  assert.throws(
    () =>
      tursoServerlessProbe({
        connection: {} as TursoServerlessConnection,
      }),
    /tursoServerlessProbe: "connection" must expose get\(\), got an object with no keys/,
  );
  assert.throws(
    () =>
      tursoServerlessProbe({
        connection: { execute: 1 } as unknown as TursoServerlessConnection,
      }),
    /got an object with keys execute/,
  );
  assert.throws(
    () =>
      tursoServerlessProbe({
        connection: undefined as unknown as TursoServerlessConnection,
      }),
    /got undefined/,
  );
});
