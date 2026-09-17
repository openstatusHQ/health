import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import {
  type NeonLikeClient,
  neonProbe,
  type NeonQueryOptions,
} from "./mod.ts";

function fakeClient(
  calls: string[],
  result: () => Promise<void> = () => Promise.resolve(),
): NeonLikeClient {
  return {
    query: (...args) => {
      calls.push(`${args[0]} argc=${args.length}`);
      return result();
    },
  };
}

function fakeSqlFunction(
  calls: string[],
  signals: (AbortSignal | undefined)[] = [],
): NeonLikeClient {
  const sql = () => Promise.resolve([]);
  sql.query = (
    text: string,
    _params?: never[],
    options?: NeonQueryOptions,
  ) => {
    calls.push(text);
    signals.push(options?.fetchOptions?.signal);
    return Promise.resolve([]);
  };
  return sql;
}

test("neonProbe() runs select 1 through query() with no extra arguments on Pool / Client", async () => {
  const calls: string[] = [];
  const report = await runProbes([neonProbe({ client: fakeClient(calls) })]);
  assert.deepEqual(calls, ["select 1 argc=1"]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "database");
  assert.equal(report.checks[0].critical, true);
});

test("neonProbe() passes the signal to the callable sql function from neon()", async () => {
  const calls: string[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  const report = await runProbes([
    neonProbe({ client: fakeSqlFunction(calls, signals) }),
  ]);
  assert.deepEqual(calls, ["select 1"]);
  assert.ok(signals[0] instanceof AbortSignal);
  assert.equal(report.status, "ok");
});

test("neonProbe() aborts the HTTP driver's signal on timeout", async () => {
  let signal: AbortSignal | undefined;
  const sql = () => Promise.resolve([]);
  sql.query = (
    _text: string,
    _params?: never[],
    options?: NeonQueryOptions,
  ) => {
    signal = options?.fetchOptions?.signal;
    return new Promise<never>(() => {});
  };
  const report = await runProbes([neonProbe({ client: sql, timeoutMs: 20 })]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(signal?.aborted, true);
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
