import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import { resendDefaultBaseUrl, resendProbe } from "./mod.ts";

const apiKey = "secret";

test("resendProbe() sends an authenticated GET /domains", async () => {
  const calls: string[] = [];
  await runProbes([
    resendProbe({
      apiKey,
      fetch: fakeFetch({
        onFetch: (call) =>
          calls.push(
            `${call.method} ${call.url} ${call.headers.get("authorization")}`,
          ),
      }),
    }),
  ]);
  assert.deepEqual(calls, [
    `GET ${resendDefaultBaseUrl}/domains Bearer secret`,
  ]);
});

test("resendProbe() honours a custom base URL", async () => {
  const calls: string[] = [];
  await runProbes([
    resendProbe({
      apiKey,
      baseUrl: "https://example.test/ignored",
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  assert.deepEqual(calls, ["https://example.test/domains"]);
});

test("resendProbe() reports ok on a 200", async () => {
  const report = await runProbes([
    resendProbe({ apiKey, fetch: fakeFetch({ status: 200 }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "resend");
  assert.equal(report.checks[0].status, "ok");
  assert.equal(report.checks[0].critical, false);
});

test("resendProbe() reports degraded on a non-2xx response", async () => {
  const report = await runProbes([
    resendProbe({ apiKey, fetch: fakeFetch({ status: 401 }) }),
  ]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("resendProbe() makes the report unhealthy when critical", async () => {
  const report = await runProbes([
    resendProbe({ apiKey, critical: true, fetch: fakeFetch({ status: 500 }) }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("resendProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes([
    resendProbe({ apiKey, fetch: hangFetch(track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("resendProbe() names the invalid option at construction", () => {
  assert.throws(
    () => resendProbe({ apiKey, baseUrl: "not a url" }),
    /resendProbe: "baseUrl" must be an absolute URL, got "not a url"/,
  );
  assert.throws(
    () => resendProbe({ apiKey: undefined as unknown as string }),
    /resendProbe: "apiKey" must be a string, got undefined/,
  );
  assert.throws(
    () => resendProbe({ apiKey: "" }),
    /resendProbe: "apiKey" must not be empty/,
  );
});

test("resendProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    resendProbe({
      apiKey,
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
