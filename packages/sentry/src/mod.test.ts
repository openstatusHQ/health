import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import { sentryDefaultBaseUrl, sentryProbe } from "./mod.ts";

const token = "secret";

test("sentryProbe() sends an authenticated GET /api/0/", async () => {
  const calls: string[] = [];
  await runProbes([
    sentryProbe({
      token,
      fetch: fakeFetch({
        onFetch: (call) =>
          calls.push(
            `${call.method} ${call.url} ${call.headers.get("authorization")}`,
          ),
      }),
    }),
  ]);
  assert.deepEqual(calls, [`GET ${sentryDefaultBaseUrl}/api/0/ Bearer secret`]);
});

test("sentryProbe() sends no authorization header without a token", async () => {
  const calls: (string | null)[] = [];
  await runProbes([
    sentryProbe({
      fetch: fakeFetch({
        onFetch: (call) => calls.push(call.headers.get("authorization")),
      }),
    }),
  ]);
  assert.deepEqual(calls, [null]);
});

test("sentryProbe() honours a custom base URL", async () => {
  const calls: string[] = [];
  await runProbes([
    sentryProbe({
      baseUrl: "https://example.test/ignored",
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  assert.deepEqual(calls, ["https://example.test/api/0/"]);
});

test("sentryProbe() reports ok on a 200", async () => {
  const report = await runProbes([
    sentryProbe({ fetch: fakeFetch({ status: 200 }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "sentry");
  assert.equal(report.checks[0].status, "ok");
  assert.equal(report.checks[0].critical, false);
});

test("sentryProbe() reports degraded on a non-2xx response", async () => {
  const report = await runProbes([
    sentryProbe({ fetch: fakeFetch({ status: 401 }) }),
  ]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("sentryProbe() makes the report unhealthy when critical", async () => {
  const report = await runProbes([
    sentryProbe({ critical: true, fetch: fakeFetch({ status: 500 }) }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("sentryProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes([
    sentryProbe({ fetch: hangFetch(track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("sentryProbe() names the invalid option at construction", () => {
  assert.throws(
    () => sentryProbe({ baseUrl: "not a url" }),
    /sentryProbe: "baseUrl" must be an absolute URL, got "not a url"/,
  );
  assert.throws(
    () => sentryProbe({ token: "" }),
    /sentryProbe: "token" must not be empty/,
  );
  assert.throws(
    () => sentryProbe({ token: 123 as unknown as string }),
    /sentryProbe: "token" must be a string, got 123/,
  );
});

test("sentryProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    sentryProbe({
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
