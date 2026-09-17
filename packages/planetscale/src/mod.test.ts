import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { type PlanetScaleLikeConnection, planetscaleProbe } from "./mod.ts";

function fakeConnection(
  calls: string[],
  result: () => Promise<void> = () => Promise.resolve(),
): PlanetScaleLikeConnection {
  return {
    execute: (query) => {
      calls.push(query);
      return result();
    },
  };
}

test("planetscaleProbe() runs select 1 through execute()", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    planetscaleProbe({ connection: fakeConnection(calls) }),
  ]);
  assert.deepEqual(calls, ["select 1"]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "database");
  assert.equal(report.checks[0].critical, true);
});

test("planetscaleProbe() reports unhealthy when execute() rejects", async () => {
  const connection = fakeConnection(
    [],
    () => Promise.reject(new Error("unauthorized")),
  );
  const report = await runProbes([planetscaleProbe({ connection })], {
    formatError: "message",
  });
  assert.equal(report.status, "unhealthy");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "unauthorized");
});

test("planetscaleProbe() times out on a hanging query", async () => {
  const connection: PlanetScaleLikeConnection = {
    execute: () => new Promise(() => {}),
  };
  const report = await runProbes([
    planetscaleProbe({ connection, timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
});

test("planetscaleProbe() throws at construction without execute()", () => {
  assert.throws(
    () => planetscaleProbe({ connection: {} as PlanetScaleLikeConnection }),
    /planetscaleProbe: "connection" must expose execute\(\), got an object with no keys/,
  );
  assert.throws(
    () =>
      planetscaleProbe({
        connection: { query: 1 } as unknown as PlanetScaleLikeConnection,
      }),
    /got an object with keys query/,
  );
  assert.throws(
    () =>
      planetscaleProbe({
        connection: undefined as unknown as PlanetScaleLikeConnection,
      }),
    /got undefined/,
  );
});

test("planetscaleProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    planetscaleProbe({
      connection: fakeConnection(calls),
      name: "planetscale",
      critical: false,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "planetscale");
  assert.equal(check.critical, false);
  assert.equal(check.status, "skipped");
  assert.deepEqual(calls, []);
});
