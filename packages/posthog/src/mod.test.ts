import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import { posthogDefaultBaseUrl, posthogProbe } from "./mod.ts";

const personalApiKey = "secret";

test("posthogProbe() sends an authenticated GET /api/projects/@current/", async () => {
  const calls: string[] = [];
  await runProbes([
    posthogProbe({
      personalApiKey,
      fetch: fakeFetch({
        onFetch: (call) =>
          calls.push(
            `${call.method} ${call.url} ${call.headers.get("authorization")}`,
          ),
      }),
    }),
  ]);
  assert.deepEqual(calls, [
    `GET ${posthogDefaultBaseUrl}/api/projects/@current/ Bearer secret`,
  ]);
});

test("posthogProbe() honours a custom base URL", async () => {
  const calls: string[] = [];
  await runProbes([
    posthogProbe({
      personalApiKey,
      baseUrl: "https://example.test/ignored",
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  assert.deepEqual(calls, ["https://example.test/api/projects/@current/"]);
});

test("posthogProbe() reports ok on a 200", async () => {
  const report = await runProbes([
    posthogProbe({ personalApiKey, fetch: fakeFetch({ status: 200 }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "posthog");
  assert.equal(report.checks[0].status, "ok");
  assert.equal(report.checks[0].critical, false);
});

test("posthogProbe() reports degraded on a non-2xx response", async () => {
  const report = await runProbes([
    posthogProbe({ personalApiKey, fetch: fakeFetch({ status: 401 }) }),
  ]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("posthogProbe() makes the report unhealthy when critical", async () => {
  const report = await runProbes([
    posthogProbe({
      personalApiKey,
      critical: true,
      fetch: fakeFetch({ status: 500 }),
    }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("posthogProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes([
    posthogProbe({ personalApiKey, fetch: hangFetch(track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("posthogProbe() names the invalid option at construction", () => {
  assert.throws(
    () => posthogProbe({ personalApiKey, baseUrl: "not a url" }),
    /posthogProbe: "baseUrl" must be an absolute URL, got "not a url"/,
  );
  assert.throws(
    () => posthogProbe({ personalApiKey: undefined as unknown as string }),
    /posthogProbe: "personalApiKey" must be a string, got undefined/,
  );
  assert.throws(
    () => posthogProbe({ personalApiKey: "" }),
    /posthogProbe: "personalApiKey" must not be empty/,
  );
});

test("posthogProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    posthogProbe({
      personalApiKey,
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
