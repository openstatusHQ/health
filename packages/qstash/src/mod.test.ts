import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import { qstashDefaultBaseUrl, qstashProbe } from "./mod.ts";

const token = "secret";

test("qstashProbe() sends an authenticated GET /v2/queues", async () => {
  const calls: string[] = [];
  await runProbes([
    qstashProbe({
      token,
      fetch: fakeFetch({
        onFetch: (call) =>
          calls.push(
            `${call.method} ${call.url} ${call.headers.get("authorization")}`,
          ),
      }),
    }),
  ]);
  assert.deepEqual(calls, [
    `GET ${qstashDefaultBaseUrl}/v2/queues Bearer secret`,
  ]);
});

test("qstashProbe() honours a custom base URL", async () => {
  const calls: string[] = [];
  await runProbes([
    qstashProbe({
      token,
      baseUrl: "https://example.test/ignored",
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  assert.deepEqual(calls, ["https://example.test/v2/queues"]);
});

test("qstashProbe() reports ok on a 200", async () => {
  const report = await runProbes([
    qstashProbe({ token, fetch: fakeFetch({ status: 200 }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "qstash");
  assert.equal(report.checks[0].status, "ok");
  assert.equal(report.checks[0].critical, false);
});

test("qstashProbe() reports degraded on a non-2xx response", async () => {
  const report = await runProbes([
    qstashProbe({ token, fetch: fakeFetch({ status: 401 }) }),
  ]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("qstashProbe() makes the report unhealthy when critical", async () => {
  const report = await runProbes([
    qstashProbe({ token, critical: true, fetch: fakeFetch({ status: 500 }) }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("qstashProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes([
    qstashProbe({ token, fetch: hangFetch(track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("qstashProbe() names the invalid option at construction", () => {
  assert.throws(
    () => qstashProbe({ token, baseUrl: "not a url" }),
    /qstashProbe: "baseUrl" must be an absolute URL, got "not a url"/,
  );
  assert.throws(
    () => qstashProbe({ token: undefined as unknown as string }),
    /qstashProbe: "token" must be a string, got undefined/,
  );
  assert.throws(
    () => qstashProbe({ token: "" }),
    /qstashProbe: "token" must not be empty/,
  );
});

test("qstashProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    qstashProbe({
      token,
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
