import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import { tinybirdProbe } from "./mod.ts";

test("tinybirdProbe() hits /v0/health on the default base URL", async () => {
  const calls: string[] = [];
  await runProbes([
    tinybirdProbe({
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  assert.deepEqual(calls, ["https://api.tinybird.co/v0/health"]);
});

test("tinybirdProbe() reports ok on a 200", async () => {
  const report = await runProbes([
    tinybirdProbe({ fetch: fakeFetch({ status: 200 }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].status, "ok");
});

test("tinybirdProbe() reports degraded on a non-2xx response", async () => {
  const report = await runProbes([
    tinybirdProbe({ fetch: fakeFetch({ status: 500 }) }),
  ]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("tinybirdProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes(
    [tinybirdProbe({ fetch: hangFetch(track), timeoutMs: 20 })],
    {
      timeoutMs: 20,
    },
  );
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("tinybirdProbe() honours a custom base URL", async () => {
  const calls: string[] = [];
  await runProbes([
    tinybirdProbe({
      baseUrl: "https://eu-central-1.tinybird.co",
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  assert.deepEqual(calls, ["https://eu-central-1.tinybird.co/v0/health"]);
});

test("tinybirdProbe() honours name, critical and skip overrides", async () => {
  const report = await runProbes([
    tinybirdProbe({
      name: "events",
      critical: true,
      skip: () => true,
      fetch: fakeFetch(),
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "events");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
});

test("tinybirdProbe() rejects a relative baseUrl at construction", () => {
  assert.throws(
    () => tinybirdProbe({ baseUrl: "api.example.com" }),
    /tinybirdProbe: "baseUrl" must be an absolute URL, got "api.example.com"/,
  );
});
