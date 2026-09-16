import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { type BullmqLikeQueue, bullmqProbe } from "./mod.ts";

function fakeQueue(
  result: () => Promise<number> = () => Promise.resolve(3),
  track?: { calls: number },
): BullmqLikeQueue {
  return {
    getWaitingCount: () => {
      if (track != null) track.calls += 1;
      return result();
    },
  };
}

test("bullmqProbe() reports ok when the count resolves", async () => {
  const track = { calls: 0 };
  const report = await runProbes([
    bullmqProbe({ queue: fakeQueue(undefined, track) }),
  ]);
  assert.equal(track.calls, 1);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "queue");
  assert.equal(report.checks[0].critical, false);
});

test("bullmqProbe() passes a backlog at or below maxWaiting", async () => {
  const report = await runProbes([
    bullmqProbe({
      queue: fakeQueue(() => Promise.resolve(10)),
      maxWaiting: 10,
    }),
  ]);
  assert.equal(report.status, "ok");
});

test("bullmqProbe() fails a backlog above maxWaiting", async () => {
  const report = await runProbes(
    [bullmqProbe({
      queue: fakeQueue(() => Promise.resolve(11)),
      maxWaiting: 10,
    })],
    { formatError: "message" },
  );
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "11 jobs waiting exceeds 10");
});

test("bullmqProbe() fails on a non-numeric count", async () => {
  const queue = fakeQueue(() => Promise.resolve(NaN));
  const report = await runProbes([bullmqProbe({ queue })], {
    formatError: "message",
  });
  assert.equal(report.checks[0].error, "unexpected waiting count");
});

test("bullmqProbe() reports failed when the count rejects", async () => {
  const queue = fakeQueue(() => Promise.reject(new Error("ECONNREFUSED")));
  const report = await runProbes([bullmqProbe({ queue })], {
    formatError: "message",
  });
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "ECONNREFUSED");
});

test("bullmqProbe() makes the report unhealthy when critical", async () => {
  const queue = fakeQueue(() => Promise.reject(new Error("down")));
  const report = await runProbes([bullmqProbe({ queue, critical: true })]);
  assert.equal(report.status, "unhealthy");
});

test("bullmqProbe() times out on a hanging count", async () => {
  const queue: BullmqLikeQueue = {
    getWaitingCount: () => new Promise(() => {}),
  };
  const report = await runProbes([bullmqProbe({ queue, timeoutMs: 20 })]);
  assert.equal(report.checks[0].status, "timeout");
});

test("bullmqProbe() throws at construction on an invalid queue or threshold", () => {
  assert.throws(
    () => bullmqProbe({ queue: {} as BullmqLikeQueue }),
    /bullmqProbe: "queue" must expose getWaitingCount\(\), got an object with no keys/,
  );
  assert.throws(
    () => bullmqProbe({ queue: undefined as unknown as BullmqLikeQueue }),
    /got undefined/,
  );
  assert.throws(
    () => bullmqProbe({ queue: fakeQueue(), maxWaiting: -1 }),
    /bullmqProbe: "maxWaiting" must be a non-negative number, got -1/,
  );
  assert.throws(
    () => bullmqProbe({ queue: fakeQueue(), maxWaiting: NaN }),
    /got NaN/,
  );
});

test("bullmqProbe() honours name, critical and skip overrides", async () => {
  const track = { calls: 0 };
  const report = await runProbes([
    bullmqProbe({
      queue: fakeQueue(undefined, track),
      name: "emails",
      critical: true,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "emails");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.equal(track.calls, 0);
});
