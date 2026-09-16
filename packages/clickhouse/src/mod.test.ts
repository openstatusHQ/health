import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import {
  type ClickHouseLikeClient,
  type ClickHousePingParams,
  type ClickHousePingResult,
  clickhouseProbe,
} from "./mod.ts";

interface Tracked {
  readonly params: ClickHousePingParams[];
}

function fakeClient(
  result: () => Promise<ClickHousePingResult>,
  track?: Tracked,
): ClickHouseLikeClient {
  return {
    ping: (params = {}) => {
      track?.params.push(params);
      return result();
    },
  };
}

function okClient(track?: Tracked): ClickHouseLikeClient {
  return fakeClient(() => Promise.resolve({ success: true }), track);
}

function hangingClient(track: { aborted: boolean }): ClickHouseLikeClient {
  return {
    ping: (params = {}) => {
      params.abort_signal?.addEventListener("abort", () => {
        track.aborted = true;
      }, { once: true });
      return new Promise(() => {});
    },
  };
}

function abortingClient(): ClickHouseLikeClient {
  return {
    ping: (params = {}) =>
      new Promise((resolve) => {
        params.abort_signal?.addEventListener("abort", () => {
          resolve({ success: false, error: new Error("request aborted") });
        }, { once: true });
      }),
  };
}

test("clickhouseProbe() reports ok when the ping succeeds", async () => {
  const report = await runProbes([clickhouseProbe({ client: okClient() })]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "clickhouse");
  assert.equal(report.checks[0].status, "ok");
  assert.equal(report.checks[0].critical, false);
});

test("clickhouseProbe() pings with a select query and the probe signal", async () => {
  const track: Tracked = { params: [] };
  await runProbes([clickhouseProbe({ client: okClient(track) })]);
  assert.equal(track.params.length, 1);
  assert.equal(track.params[0].select, true);
  assert.ok(track.params[0].abort_signal instanceof AbortSignal);
});

test("clickhouseProbe() honours select: false for the /ping endpoint", async () => {
  const track: Tracked = { params: [] };
  await runProbes([
    clickhouseProbe({ client: okClient(track), select: false }),
  ]);
  assert.equal(track.params[0].select, false);
});

test("clickhouseProbe() reports degraded when ping returns success: false", async () => {
  const client = fakeClient(() =>
    Promise.resolve({
      success: false,
      error: new Error("connect ECONNREFUSED"),
    })
  );
  const report = await runProbes([clickhouseProbe({ client })]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("clickhouseProbe() surfaces the ping error with formatError", async () => {
  const client = fakeClient(() =>
    Promise.resolve({
      success: false,
      error: new Error("authentication failed"),
    })
  );
  const report = await runProbes([clickhouseProbe({ client })], {
    formatError: "message",
  });
  assert.equal(report.checks[0].error, "authentication failed");
});

test("clickhouseProbe() reports failed when ping itself rejects", async () => {
  const client = fakeClient(() => Promise.reject(new Error("boom")));
  const report = await runProbes([clickhouseProbe({ client })]);
  assert.equal(report.checks[0].status, "failed");
});

test("clickhouseProbe() makes the report unhealthy when critical", async () => {
  const client = fakeClient(() =>
    Promise.resolve({ success: false, error: new Error("down") })
  );
  const report = await runProbes([clickhouseProbe({ client, critical: true })]);
  assert.equal(report.status, "unhealthy");
});

test("clickhouseProbe() times out and aborts the ping", async () => {
  const track = { aborted: false };
  const report = await runProbes([
    clickhouseProbe({ client: hangingClient(track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("clickhouseProbe() reports timeout when the client resolves success: false on abort", async () => {
  const report = await runProbes([
    clickhouseProbe({ client: abortingClient(), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
});

test("clickhouseProbe() throws at construction on a client without ping()", () => {
  assert.throws(
    () => clickhouseProbe({ client: {} as ClickHouseLikeClient }),
    /clickhouseProbe: "client" must expose ping\(\), got an object with no keys/,
  );
  assert.throws(
    () =>
      clickhouseProbe({
        client: { query: 1 } as unknown as ClickHouseLikeClient,
      }),
    /got an object with keys query/,
  );
  assert.throws(
    () =>
      clickhouseProbe({ client: undefined as unknown as ClickHouseLikeClient }),
    /got undefined/,
  );
});

test("clickhouseProbe() honours name, critical and skip overrides", async () => {
  const track: Tracked = { params: [] };
  const report = await runProbes([
    clickhouseProbe({
      client: okClient(track),
      name: "analytics",
      critical: true,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "analytics");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.equal(track.params.length, 0);
});
