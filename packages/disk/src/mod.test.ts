import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { diskProbe, type DiskStatfs, type DiskStats } from "./mod.ts";

function fakeStatfs(
  calls: string[],
  stats: DiskStats = { bsize: 4096, blocks: 1_000_000, bavail: 500_000 },
): DiskStatfs {
  return (path) => {
    calls.push(path);
    return Promise.resolve(stats);
  };
}

test("diskProbe() reads the current directory by default", async () => {
  const calls: string[] = [];
  const report = await runProbes([diskProbe({ statfs: fakeStatfs(calls) })]);
  assert.deepEqual(calls, ["."]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "disk");
  assert.equal(report.checks[0].critical, false);
});

test("diskProbe() honours the path option", async () => {
  const calls: string[] = [];
  await runProbes([diskProbe({ path: "/data", statfs: fakeStatfs(calls) })]);
  assert.deepEqual(calls, ["/data"]);
});

test("diskProbe() fails below the default 10% free", async () => {
  const stats = { bsize: 4096, blocks: 1_000_000, bavail: 50_000 };
  const report = await runProbes(
    [diskProbe({ statfs: fakeStatfs([], stats) })],
    { formatError: "message" },
  );
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "5% free, less than 10%");
});

test("diskProbe() honours minFreePercent", async () => {
  const stats = { bsize: 4096, blocks: 1_000_000, bavail: 50_000 };
  const report = await runProbes([
    diskProbe({ minFreePercent: 5, statfs: fakeStatfs([], stats) }),
  ]);
  assert.equal(report.status, "ok");
});

test("diskProbe() honours minFreeBytes and drops the percent default", async () => {
  const stats = { bsize: 4096, blocks: 1_000_000, bavail: 50_000 };
  const ok = await runProbes([
    diskProbe({
      minFreeBytes: 100 * 1024 * 1024,
      statfs: fakeStatfs([], stats),
    }),
  ]);
  assert.equal(ok.status, "ok");
  const low = await runProbes(
    [diskProbe({ minFreeBytes: 1024 ** 3, statfs: fakeStatfs([], stats) })],
    { formatError: "message" },
  );
  assert.equal(
    low.checks[0].error,
    "204800000 bytes free, fewer than 1073741824",
  );
});

test("diskProbe() fails on an unexpected statfs result", async () => {
  const report = await runProbes(
    [diskProbe({
      statfs: fakeStatfs([], { bsize: 4096, blocks: 0, bavail: 0 }),
    })],
    { formatError: "message" },
  );
  assert.equal(report.checks[0].error, "unexpected statfs result");
});

test("diskProbe() reports failed when statfs() rejects", async () => {
  const report = await runProbes(
    [diskProbe({ statfs: () => Promise.reject(new Error("ENOENT")) })],
    { formatError: "message" },
  );
  assert.equal(report.checks[0].error, "ENOENT");
});

test("diskProbe() makes the report unhealthy when critical", async () => {
  const report = await runProbes([
    diskProbe({ critical: true, statfs: () => Promise.reject(new Error("x")) }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("diskProbe() reads the real filesystem", async () => {
  const report = await runProbes([diskProbe({ minFreePercent: 0 })]);
  assert.equal(report.status, "ok");
});

test("diskProbe() names the invalid option at construction", () => {
  assert.throws(
    () => diskProbe({ path: "" }),
    /diskProbe: "path" must not be empty/,
  );
  assert.throws(
    () => diskProbe({ minFreePercent: -1 }),
    /diskProbe: "minFreePercent" must be a non-negative number, got -1/,
  );
  assert.throws(
    () => diskProbe({ minFreeBytes: NaN }),
    /diskProbe: "minFreeBytes" must be a non-negative number, got NaN/,
  );
});

test("diskProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    diskProbe({
      statfs: fakeStatfs(calls),
      name: "data-volume",
      critical: true,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "data-volume");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.deepEqual(calls, []);
});
