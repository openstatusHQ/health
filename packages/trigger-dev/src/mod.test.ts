import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import { triggerDevProbe } from "./mod.ts";

const secretKey = "secret";

test("triggerDevProbe() sends an authenticated GET /api/v1/runs?page[size]=1", async () => {
  const calls: string[] = [];
  await runProbes([
    triggerDevProbe({
      secretKey,
      fetch: fakeFetch({
        onFetch: (call) =>
          calls.push(
            `${call.method} ${call.url} ${call.headers.get("authorization")}`,
          ),
      }),
    }),
  ]);
  assert.deepEqual(calls, [
    "GET https://api.trigger.dev/api/v1/runs?page[size]=1 Bearer secret",
  ]);
});

test("triggerDevProbe() honours a custom base URL", async () => {
  const calls: string[] = [];
  await runProbes([
    triggerDevProbe({
      secretKey,
      baseUrl: "https://example.test/ignored",
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  assert.deepEqual(calls, ["https://example.test/api/v1/runs?page[size]=1"]);
});

test("triggerDevProbe() reports ok on a 200", async () => {
  const report = await runProbes([
    triggerDevProbe({ secretKey, fetch: fakeFetch({ status: 200 }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "trigger");
  assert.equal(report.checks[0].status, "ok");
  assert.equal(report.checks[0].critical, false);
});

test("triggerDevProbe() reports degraded on a non-2xx response", async () => {
  const report = await runProbes([
    triggerDevProbe({ secretKey, fetch: fakeFetch({ status: 401 }) }),
  ]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("triggerDevProbe() makes the report unhealthy when critical", async () => {
  const report = await runProbes([
    triggerDevProbe({
      secretKey,
      critical: true,
      fetch: fakeFetch({ status: 500 }),
    }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("triggerDevProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes([
    triggerDevProbe({ secretKey, fetch: hangFetch(track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("triggerDevProbe() names the invalid option at construction", () => {
  assert.throws(
    () => triggerDevProbe({ secretKey, baseUrl: "not a url" }),
    /triggerDevProbe: "baseUrl" must be an absolute URL, got "not a url"/,
  );
  assert.throws(
    () => triggerDevProbe({ secretKey: undefined as unknown as string }),
    /triggerDevProbe: "secretKey" must be a string, got undefined/,
  );
  assert.throws(
    () => triggerDevProbe({ secretKey: "" }),
    /triggerDevProbe: "secretKey" must not be empty/,
  );
});

test("triggerDevProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    triggerDevProbe({
      secretKey,
      name: "billing",
      critical: true,
      skip: () => true,
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "billing");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.deepEqual(calls, []);
});
