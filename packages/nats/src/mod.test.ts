import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { type NatsLikeConnection, natsProbe } from "./mod.ts";

function fakeConnection(
  result: () => Promise<void> = () => Promise.resolve(),
  track?: { flushes: number },
  closed?: boolean,
): NatsLikeConnection {
  return {
    flush: () => {
      if (track != null) track.flushes += 1;
      return result();
    },
    ...(closed == null ? {} : { isClosed: () => closed }),
  };
}

test("natsProbe() reports ok when flush() resolves", async () => {
  const track = { flushes: 0 };
  const report = await runProbes([
    natsProbe({ connection: fakeConnection(undefined, track) }),
  ]);
  assert.equal(track.flushes, 1);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "nats");
  assert.equal(report.checks[0].critical, false);
});

test("natsProbe() flushes an open connection with isClosed()", async () => {
  const track = { flushes: 0 };
  const report = await runProbes([
    natsProbe({ connection: fakeConnection(undefined, track, false) }),
  ]);
  assert.equal(track.flushes, 1);
  assert.equal(report.status, "ok");
});

test("natsProbe() fails without flushing when the connection is closed", async () => {
  const track = { flushes: 0 };
  const report = await runProbes(
    [natsProbe({ connection: fakeConnection(undefined, track, true) })],
    { formatError: "message" },
  );
  assert.equal(track.flushes, 0);
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "connection closed");
});

test("natsProbe() reports degraded when flush() rejects", async () => {
  const connection = fakeConnection(() =>
    Promise.reject(new Error("CONNECTION_CLOSED"))
  );
  const report = await runProbes([natsProbe({ connection })], {
    formatError: "message",
  });
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "CONNECTION_CLOSED");
});

test("natsProbe() makes the report unhealthy when critical", async () => {
  const connection = fakeConnection(() => Promise.reject(new Error("down")));
  const report = await runProbes([natsProbe({ connection, critical: true })]);
  assert.equal(report.status, "unhealthy");
});

test("natsProbe() times out on a hanging flush", async () => {
  const connection: NatsLikeConnection = { flush: () => new Promise(() => {}) };
  const report = await runProbes([natsProbe({ connection, timeoutMs: 20 })]);
  assert.equal(report.checks[0].status, "timeout");
});

test("natsProbe() throws at construction without flush()", () => {
  assert.throws(
    () => natsProbe({ connection: {} as NatsLikeConnection }),
    /natsProbe: "connection" must expose flush\(\), got an object with no keys/,
  );
  assert.throws(
    () =>
      natsProbe({
        connection: { publish: 1 } as unknown as NatsLikeConnection,
      }),
    /got an object with keys publish/,
  );
  assert.throws(
    () => natsProbe({ connection: undefined as unknown as NatsLikeConnection }),
    /got undefined/,
  );
});

test("natsProbe() honours name, critical and skip overrides", async () => {
  const track = { flushes: 0 };
  const report = await runProbes([
    natsProbe({
      connection: fakeConnection(undefined, track),
      name: "events",
      critical: true,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "events");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.equal(track.flushes, 0);
});
