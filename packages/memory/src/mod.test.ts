import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { memoryProbe } from "./mod.ts";

const mb = 1024 * 1024;

function samples(heapUsed: number, rss: number, limit = 1000 * mb) {
  return {
    memoryUsage: () => ({ heapUsed, rss }),
    heapStatistics: () => ({ heap_size_limit: limit }),
  };
}

test("memoryProbe() reports ok under the default 90% heap threshold", async () => {
  const report = await runProbes([memoryProbe(samples(500 * mb, 700 * mb))]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "memory");
  assert.equal(report.checks[0].critical, false);
});

test("memoryProbe() fails above the default heap threshold", async () => {
  const report = await runProbes(
    [memoryProbe(samples(950 * mb, 1200 * mb))],
    { formatError: "message" },
  );
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "heap 95% used exceeds 90%");
});

test("memoryProbe() honours maxHeapUsedPercent", async () => {
  const report = await runProbes([
    memoryProbe({ maxHeapUsedPercent: 99, ...samples(950 * mb, 1200 * mb) }),
  ]);
  assert.equal(report.status, "ok");
});

test("memoryProbe() honours maxRssBytes and drops the heap default", async () => {
  const ok = await runProbes([
    memoryProbe({ maxRssBytes: 2000 * mb, ...samples(950 * mb, 1200 * mb) }),
  ]);
  assert.equal(ok.status, "ok");
  const high = await runProbes(
    [memoryProbe({ maxRssBytes: 1000 * mb, ...samples(100 * mb, 1200 * mb) })],
    { formatError: "message" },
  );
  assert.equal(
    high.checks[0].error,
    `rss ${1200 * mb} bytes exceeds ${1000 * mb}`,
  );
});

test("memoryProbe() fails on unexpected statistics", async () => {
  for (
    const options of [
      samples(100 * mb, 200 * mb, 0),
      samples(Infinity, 200 * mb),
      samples(100 * mb, NaN),
      samples(100 * mb, 200 * mb, Infinity),
    ]
  ) {
    const report = await runProbes([memoryProbe(options)], {
      formatError: "message",
    });
    assert.equal(report.checks[0].error, "unexpected memory statistics");
  }
});

test("memoryProbe() enforces maxHeapUsedPercent on the exact ratio, not the rounded one", async () => {
  const report = await runProbes(
    [memoryProbe({ maxHeapUsedPercent: 90, ...samples(900.4 * mb, 0) })],
    { formatError: "message" },
  );
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "heap 90% used exceeds 90%");
});

test("memoryProbe() makes the report unhealthy when critical", async () => {
  const report = await runProbes([
    memoryProbe({ critical: true, ...samples(999 * mb, 1200 * mb) }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("memoryProbe() reads the real process", async () => {
  const report = await runProbes([memoryProbe({ maxHeapUsedPercent: 100 })]);
  assert.equal(report.status, "ok");
});

test("memoryProbe() names the invalid option at construction", () => {
  assert.throws(
    () => memoryProbe({ maxHeapUsedPercent: -1 }),
    /memoryProbe: "maxHeapUsedPercent" must be a non-negative number, got -1/,
  );
  assert.throws(
    () => memoryProbe({ maxRssBytes: Infinity }),
    /memoryProbe: "maxRssBytes" must be a non-negative number, got Infinity/,
  );
});

test("memoryProbe() honours name, critical and skip overrides", async () => {
  let calls = 0;
  const report = await runProbes([
    memoryProbe({
      memoryUsage: () => {
        calls += 1;
        return { heapUsed: 1, rss: 1 };
      },
      heapStatistics: () => ({ heap_size_limit: 100 }),
      name: "heap",
      critical: true,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "heap");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.equal(calls, 0);
});
