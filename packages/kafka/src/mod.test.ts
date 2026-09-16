import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import {
  type KafkaClusterDescription,
  type KafkaLikeAdmin,
  kafkaProbe,
} from "./mod.ts";

function fakeAdmin(
  result: () => Promise<KafkaClusterDescription> = () =>
    Promise.resolve({ brokers: [{ nodeId: 1 }, { nodeId: 2 }] }),
  track?: { calls: number },
): KafkaLikeAdmin {
  return {
    describeCluster: () => {
      if (track != null) track.calls += 1;
      return result();
    },
  };
}

test("kafkaProbe() reports ok when brokers are listed", async () => {
  const track = { calls: 0 };
  const report = await runProbes([
    kafkaProbe({ admin: fakeAdmin(undefined, track) }),
  ]);
  assert.equal(track.calls, 1);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "kafka");
  assert.equal(report.checks[0].critical, false);
});

test("kafkaProbe() fails when the cluster has no brokers", async () => {
  const admin = fakeAdmin(() => Promise.resolve({ brokers: [] }));
  const report = await runProbes([kafkaProbe({ admin })], {
    formatError: "message",
  });
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "no brokers in cluster");
});

test("kafkaProbe() fails on an unexpected response shape", async () => {
  const admin = fakeAdmin(() =>
    Promise.resolve({} as unknown as KafkaClusterDescription)
  );
  const report = await runProbes([kafkaProbe({ admin })], {
    formatError: "message",
  });
  assert.equal(report.checks[0].error, "unexpected response shape");
});

test("kafkaProbe() reports failed when describeCluster() rejects", async () => {
  const admin = fakeAdmin(() =>
    Promise.reject(new Error("KafkaJSConnectionError"))
  );
  const report = await runProbes([kafkaProbe({ admin })], {
    formatError: "message",
  });
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "KafkaJSConnectionError");
});

test("kafkaProbe() makes the report unhealthy when critical", async () => {
  const admin = fakeAdmin(() => Promise.reject(new Error("down")));
  const report = await runProbes([kafkaProbe({ admin, critical: true })]);
  assert.equal(report.status, "unhealthy");
});

test("kafkaProbe() times out on a hanging request", async () => {
  const admin: KafkaLikeAdmin = {
    describeCluster: () => new Promise(() => {}),
  };
  const report = await runProbes([kafkaProbe({ admin, timeoutMs: 20 })]);
  assert.equal(report.checks[0].status, "timeout");
});

test("kafkaProbe() throws at construction without describeCluster()", () => {
  assert.throws(
    () => kafkaProbe({ admin: {} as KafkaLikeAdmin }),
    /kafkaProbe: "admin" must expose describeCluster\(\), got an object with no keys/,
  );
  assert.throws(
    () => kafkaProbe({ admin: { connect: 1 } as unknown as KafkaLikeAdmin }),
    /got an object with keys connect/,
  );
  assert.throws(
    () => kafkaProbe({ admin: undefined as unknown as KafkaLikeAdmin }),
    /got undefined/,
  );
});

test("kafkaProbe() honours name, critical and skip overrides", async () => {
  const track = { calls: 0 };
  const report = await runProbes([
    kafkaProbe({
      admin: fakeAdmin(undefined, track),
      name: "events",
      critical: true,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "events");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.equal(track.calls, 0);
});
