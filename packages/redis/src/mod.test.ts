import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { type RedisLikeClient, redisProbe } from "./mod.ts";

function fakeClient(
  result: () => Promise<string> = () => Promise.resolve("PONG"),
  track?: { calls: number },
): RedisLikeClient {
  return {
    ping: () => {
      if (track != null) track.calls += 1;
      return result();
    },
  };
}

test("redisProbe() reports ok on PONG", async () => {
  const track = { calls: 0 };
  const report = await runProbes([
    redisProbe({ client: fakeClient(undefined, track) }),
  ]);
  assert.equal(track.calls, 1);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "redis");
  assert.equal(report.checks[0].critical, false);
});

test("redisProbe() accepts a lowercase pong and non-string replies", async () => {
  for (
    const reply of [
      () => Promise.resolve("pong"),
      () => Promise.resolve(undefined as unknown as string),
    ]
  ) {
    const report = await runProbes([redisProbe({ client: fakeClient(reply) })]);
    assert.equal(report.status, "ok");
  }
});

test("redisProbe() reports degraded on an unexpected reply", async () => {
  const report = await runProbes(
    [redisProbe({ client: fakeClient(() => Promise.resolve("LOADING")) })],
    { formatError: "message" },
  );
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, 'unexpected reply "LOADING"');
});

test("redisProbe() reports failed when ping() rejects", async () => {
  const client = fakeClient(() =>
    Promise.reject(new Error("connect ECONNREFUSED"))
  );
  const report = await runProbes([redisProbe({ client })], {
    formatError: "message",
  });
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "connect ECONNREFUSED");
});

test("redisProbe() makes the report unhealthy when critical", async () => {
  const client = fakeClient(() => Promise.reject(new Error("down")));
  const report = await runProbes([redisProbe({ client, critical: true })]);
  assert.equal(report.status, "unhealthy");
});

test("redisProbe() times out on a hanging ping", async () => {
  const client: RedisLikeClient = { ping: () => new Promise(() => {}) };
  const report = await runProbes([redisProbe({ client, timeoutMs: 20 })]);
  assert.equal(report.checks[0].status, "timeout");
});

test("redisProbe() throws at construction without ping()", () => {
  assert.throws(
    () => redisProbe({ client: {} as RedisLikeClient }),
    /redisProbe: "client" must expose ping\(\), got an object with no keys/,
  );
  assert.throws(
    () => redisProbe({ client: { get: 1 } as unknown as RedisLikeClient }),
    /got an object with keys get/,
  );
  assert.throws(
    () => redisProbe({ client: undefined as unknown as RedisLikeClient }),
    /got undefined/,
  );
});

test("redisProbe() honours name, critical and skip overrides", async () => {
  const track = { calls: 0 };
  const report = await runProbes([
    redisProbe({
      client: fakeClient(undefined, track),
      name: "cache",
      critical: true,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "cache");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.equal(track.calls, 0);
});
