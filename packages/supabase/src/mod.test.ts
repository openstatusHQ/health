import assert from "node:assert/strict";
import test from "node:test";
import { type JsonObject, runProbes } from "@openstatus/health";
import {
  SupabaseConnectionPressureError,
  type SupabaseConnectionPressureRow,
  type SupabaseLikeClient,
  supabaseProbe,
  type SupabaseRpcBuilder,
  type SupabaseRpcData,
  type SupabaseRpcError,
} from "./mod.ts";

interface Tracked {
  readonly rpc: string[];
  readonly signals: AbortSignal[];
}

function fakeClient(
  data: SupabaseRpcData,
  error: SupabaseRpcError | null = null,
  track?: Tracked,
): SupabaseLikeClient {
  const builder = (): SupabaseRpcBuilder => ({
    then: (onfulfilled, onrejected) =>
      Promise.resolve({ data, error }).then(onfulfilled, onrejected),
    abortSignal: (signal) => {
      track?.signals.push(signal);
      return builder();
    },
  });
  return {
    rpc: (fn) => {
      track?.rpc.push(fn);
      return builder();
    },
  };
}

function belowThreshold(): SupabaseConnectionPressureRow & JsonObject {
  return {
    current_connections: 24,
    active_connections: 5,
    waiting_connections: 0,
    max_connections: 100,
    connection_percent: 24,
  };
}

test("supabaseProbe() calls the default rpc and passes the signal", async () => {
  const track: Tracked = { rpc: [], signals: [] };
  const report = await runProbes([
    supabaseProbe({ client: fakeClient(belowThreshold(), null, track) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].status, "ok");
  assert.deepEqual(track.rpc, ["health_connection_pressure"]);
  assert.equal(track.signals.length, 1);
  assert.equal(track.signals[0].aborted, false);
});

test("supabaseProbe() accepts an array of rows", async () => {
  const report = await runProbes([
    supabaseProbe({ client: fakeClient([belowThreshold()]) }),
  ]);
  assert.equal(report.status, "ok");
});

test("supabaseProbe() fails above maxConnectionPercent", async () => {
  const report = await runProbes([
    supabaseProbe({
      client: fakeClient({ ...belowThreshold(), connection_percent: 95 }),
    }),
  ]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("supabaseProbe() honours a custom maxConnectionPercent", async () => {
  const report = await runProbes([
    supabaseProbe({
      client: fakeClient({ ...belowThreshold(), connection_percent: 85 }),
      maxConnectionPercent: 80,
    }),
  ]);
  assert.equal(report.checks[0].status, "failed");
});

test("supabaseProbe() fails when the rpc returns an error", async () => {
  const report = await runProbes([
    supabaseProbe({
      client: fakeClient(null, { message: "permission denied" }),
    }),
  ]);
  assert.equal(report.checks[0].status, "failed");
});

test("supabaseProbe() fails on an unexpected response shape", async () => {
  const report = await runProbes([
    supabaseProbe({ client: fakeClient({ foo: "bar" }) }),
  ]);
  assert.equal(report.checks[0].status, "failed");
});

test("supabaseProbe() fails on a nested array row", async () => {
  const report = await runProbes([
    supabaseProbe({ client: fakeClient([[]]) }),
  ]);
  assert.equal(report.checks[0].status, "failed");
});

test("supabaseProbe() fails on a non-finite connection_percent", async () => {
  const report = await runProbes([
    supabaseProbe({
      client: fakeClient({
        ...belowThreshold(),
        connection_percent: Number.NaN,
      }),
    }),
  ]);
  assert.equal(report.checks[0].status, "failed");
});

test("supabaseProbe() rejects an invalid maxConnectionPercent", () => {
  assert.throws(
    () =>
      supabaseProbe({
        client: fakeClient(belowThreshold()),
        maxConnectionPercent: Number.NaN,
      }),
    /supabaseProbe: "maxConnectionPercent" must be a non-negative number/,
  );
  assert.throws(
    () =>
      supabaseProbe({
        client: fakeClient(belowThreshold()),
        maxConnectionPercent: -1,
      }),
    /must be a non-negative number/,
  );
});

test("supabaseProbe() honours an rpc override", async () => {
  const track: Tracked = { rpc: [], signals: [] };
  await runProbes([
    supabaseProbe({
      client: fakeClient(belowThreshold(), null, track),
      rpc: "check_connections",
    }),
  ]);
  assert.deepEqual(track.rpc, ["check_connections"]);
});

test("supabaseProbe() honours name, critical and skip overrides", async () => {
  const report = await runProbes([
    supabaseProbe({
      client: fakeClient(belowThreshold()),
      name: "postgres",
      critical: true,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "postgres");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
});

test("supabaseProbe() exposes the row through formatError", async () => {
  const report = await runProbes([
    supabaseProbe({
      client: fakeClient({ ...belowThreshold(), connection_percent: 95 }),
    }),
  ], {
    formatError: (e) =>
      e instanceof SupabaseConnectionPressureError
        ? `${e.message} (${e.row.current_connections}/${e.row.max_connections})`
        : e.message,
  });
  assert.equal(
    report.checks[0].error,
    "connection pressure 95% exceeds 90% (24/100)",
  );
});
