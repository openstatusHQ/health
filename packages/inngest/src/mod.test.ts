import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import { inngestDefaultBaseUrl, inngestProbe } from "./mod.ts";

const signingKey = "secret";

test("inngestProbe() sends an authenticated GET /v1/events?limit=1", async () => {
  const calls: string[] = [];
  await runProbes([
    inngestProbe({
      signingKey,
      fetch: fakeFetch({
        onFetch: (call) =>
          calls.push(
            `${call.method} ${call.url} ${call.headers.get("authorization")}`,
          ),
      }),
    }),
  ]);
  assert.deepEqual(calls, [
    `GET ${inngestDefaultBaseUrl}/v1/events?limit=1 Bearer secret`,
  ]);
});

test("inngestProbe() honours a custom base URL", async () => {
  const calls: string[] = [];
  await runProbes([
    inngestProbe({
      signingKey,
      baseUrl: "https://example.test/ignored",
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  assert.deepEqual(calls, ["https://example.test/v1/events?limit=1"]);
});

test("inngestProbe() reports ok on a 200", async () => {
  const report = await runProbes([
    inngestProbe({ signingKey, fetch: fakeFetch({ status: 200 }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "inngest");
  assert.equal(report.checks[0].status, "ok");
  assert.equal(report.checks[0].critical, false);
});

test("inngestProbe() reports degraded on a non-2xx response", async () => {
  const report = await runProbes([
    inngestProbe({ signingKey, fetch: fakeFetch({ status: 401 }) }),
  ]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("inngestProbe() makes the report unhealthy when critical", async () => {
  const report = await runProbes([
    inngestProbe({
      signingKey,
      critical: true,
      fetch: fakeFetch({ status: 500 }),
    }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("inngestProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes([
    inngestProbe({ signingKey, fetch: hangFetch(track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("inngestProbe() names the invalid option at construction", () => {
  assert.throws(
    () => inngestProbe({ signingKey, baseUrl: "not a url" }),
    /inngestProbe: "baseUrl" must be an absolute URL, got "not a url"/,
  );
  assert.throws(
    () => inngestProbe({ signingKey: undefined as unknown as string }),
    /inngestProbe: "signingKey" must be a string, got undefined/,
  );
  assert.throws(
    () => inngestProbe({ signingKey: "" }),
    /inngestProbe: "signingKey" must not be empty/,
  );
});

test("inngestProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    inngestProbe({
      signingKey,
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
