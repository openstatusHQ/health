import assert from "node:assert/strict";
import test from "node:test";
import type { SQL } from "drizzle-orm";
import { drizzle as drizzlePg } from "drizzle-orm/pg-proxy";
import { drizzle as drizzleSqlite } from "drizzle-orm/sqlite-proxy";
import { runProbes } from "@openstatus/health";
import { type DrizzleLikeDb, drizzleProbe } from "./mod.ts";

function pgLikeDb(calls: SQL[] = []): DrizzleLikeDb {
  return {
    execute: (query) => {
      calls.push(query);
      return Promise.resolve({ rows: [{ 1: 1 }] });
    },
  };
}

function sqliteLikeDb(calls: SQL[] = []): DrizzleLikeDb {
  return {
    run: (query) => {
      calls.push(query);
      return Promise.resolve({ rows: [{ 1: 1 }] });
    },
  };
}

test("drizzleProbe() uses execute when present (pg/mysql)", async () => {
  const calls: SQL[] = [];
  const report = await runProbes([drizzleProbe({ db: pgLikeDb(calls) })]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].status, "ok");
  assert.equal(calls.length, 1);
  assert.ok(JSON.stringify(calls[0]).includes("select 1"));
});

test("drizzleProbe() falls back to run for sqlite/libsql", async () => {
  const calls: SQL[] = [];
  const report = await runProbes([drizzleProbe({ db: sqliteLikeDb(calls) })]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].status, "ok");
  assert.equal(calls.length, 1);
});

test("drizzleProbe() calls execute on a real pg drizzle instance", async () => {
  const calls: string[] = [];
  const db = drizzlePg((query) => {
    calls.push(query);
    return Promise.resolve({ rows: [] });
  });
  const report = await runProbes([drizzleProbe({ db })], {
    formatError: "message",
  });
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].status, "ok");
  assert.deepEqual(calls, ["select 1"]);
});

test("drizzleProbe() calls run on a real sqlite drizzle instance", async () => {
  const calls: string[] = [];
  const db = drizzleSqlite((query) => {
    calls.push(query);
    return Promise.resolve({ rows: [] });
  });
  const report = await runProbes([drizzleProbe({ db })], {
    formatError: "message",
  });
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].status, "ok");
  assert.deepEqual(calls, ["select 1"]);
});

test("drizzleProbe() defaults to critical with the name database", async () => {
  const report = await runProbes([drizzleProbe({ db: pgLikeDb() })]);
  const check = report.checks[0];
  assert.equal(check.name, "database");
  assert.equal(check.critical, true);
});

test("drizzleProbe() reports unhealthy on a rejection", async () => {
  const db: DrizzleLikeDb = {
    execute: () => Promise.reject(new Error("boom")),
  };
  const report = await runProbes([drizzleProbe({ db })]);
  assert.equal(report.status, "unhealthy");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("drizzleProbe() throws at construction on an unsupported instance", () => {
  assert.throws(
    () => drizzleProbe({ db: {} }),
    /drizzleProbe: "db" must expose execute\(\) or run\(\), got an object with no keys/,
  );
  assert.throws(
    () => drizzleProbe({ db: { query: 1 } as DrizzleLikeDb }),
    /got an object with keys query/,
  );
  assert.throws(
    () => drizzleProbe({ db: 42 as unknown as DrizzleLikeDb }),
    /got number/,
  );
});

test("drizzleProbe() honours name, critical and skip overrides", async () => {
  const report = await runProbes([
    drizzleProbe({
      db: pgLikeDb(),
      name: "primary",
      critical: false,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "primary");
  assert.equal(check.critical, false);
  assert.equal(check.status, "skipped");
});
