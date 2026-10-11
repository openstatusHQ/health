import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import { unkeyProbe } from "./mod.ts";

test("unkeyProbe() hits /v2/liveness on the default base URL", async () => {
  const calls: string[] = [];
  await runProbes([
    unkeyProbe({
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  assert.deepEqual(calls, ["https://api.unkey.com/v2/liveness"]);
});

test("unkeyProbe() reports ok on a 200", async () => {
  const report = await runProbes([
    unkeyProbe({ fetch: fakeFetch({ status: 200 }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].status, "ok");
});

test("unkeyProbe() reports degraded on a non-2xx response", async () => {
  const report = await runProbes([
    unkeyProbe({ fetch: fakeFetch({ status: 500 }) }),
  ]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("unkeyProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes(
    [unkeyProbe({ fetch: hangFetch(track), timeoutMs: 20 })],
    {
      timeoutMs: 20,
    },
  );
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("unkeyProbe() honours a custom base URL", async () => {
  const calls: string[] = [];
  await runProbes([
    unkeyProbe({
      baseUrl: "https://eu.unkey.com",
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  assert.deepEqual(calls, ["https://eu.unkey.com/v2/liveness"]);
});

test("unkeyProbe() honours name, critical and skip overrides", async () => {
  const report = await runProbes([
    unkeyProbe({
      name: "auth",
      critical: true,
      skip: () => true,
      fetch: fakeFetch(),
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "auth");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
});

test("unkeyProbe() rejects a relative baseUrl at construction", () => {
  assert.throws(
    () => unkeyProbe({ baseUrl: "api.example.com" }),
    /unkeyProbe: "baseUrl" must be an absolute URL, got "api.example.com"/,
  );
});
