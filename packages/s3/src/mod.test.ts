import assert from "node:assert/strict";
import test from "node:test";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { runProbes } from "@openstatus/health";
import { type S3LikeClient, s3Probe, type S3SendOptions } from "./mod.ts";

interface Call {
  readonly command: HeadBucketCommand;
  readonly options: S3SendOptions | undefined;
}

function fakeClient(
  calls: Call[],
  result: () => Promise<void> = () => Promise.resolve(),
): S3LikeClient {
  return {
    send: (command, options) => {
      calls.push({ command, options });
      return result();
    },
  };
}

test("s3Probe() sends HeadBucket for the bucket with the probe signal", async () => {
  const calls: Call[] = [];
  const report = await runProbes([
    s3Probe({ client: fakeClient(calls), bucket: "uploads" }),
  ]);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].command instanceof HeadBucketCommand);
  assert.equal(calls[0].command.input.Bucket, "uploads");
  assert.ok(calls[0].options?.abortSignal instanceof AbortSignal);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "storage");
  assert.equal(report.checks[0].critical, false);
});

test("s3Probe() reports degraded when send() rejects", async () => {
  const client = fakeClient(
    [],
    () => Promise.reject(new Error("NoSuchBucket")),
  );
  const report = await runProbes([s3Probe({ client, bucket: "uploads" })], {
    formatError: "message",
  });
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "NoSuchBucket");
});

test("s3Probe() makes the report unhealthy when critical", async () => {
  const client = fakeClient([], () => Promise.reject(new Error("down")));
  const report = await runProbes([
    s3Probe({ client, bucket: "uploads", critical: true }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("s3Probe() times out and aborts the request", async () => {
  let aborted = false;
  const client: S3LikeClient = {
    send: (_command, options) => {
      options?.abortSignal?.addEventListener("abort", () => {
        aborted = true;
      }, { once: true });
      return new Promise(() => {});
    },
  };
  const report = await runProbes([
    s3Probe({ client, bucket: "uploads", timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(aborted, true);
});

test("s3Probe() throws at construction on an invalid client or bucket", () => {
  assert.throws(
    () => s3Probe({ client: {} as S3LikeClient, bucket: "uploads" }),
    /s3Probe: "client" must expose send\(\), got an object with no keys/,
  );
  assert.throws(
    () =>
      s3Probe({ client: undefined as unknown as S3LikeClient, bucket: "b" }),
    /got undefined/,
  );
  assert.throws(
    () => s3Probe({ client: fakeClient([]), bucket: "" }),
    /s3Probe: "bucket" must not be empty/,
  );
  assert.throws(
    () => s3Probe({ client: fakeClient([]), bucket: 1 as unknown as string }),
    /s3Probe: "bucket" must be a string, got 1/,
  );
});

test("s3Probe() honours name, critical and skip overrides", async () => {
  const calls: Call[] = [];
  const report = await runProbes([
    s3Probe({
      client: fakeClient(calls),
      bucket: "uploads",
      name: "uploads",
      critical: true,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "uploads");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.deepEqual(calls, []);
});
