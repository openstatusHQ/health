import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import { workosDefaultBaseUrl, workosProbe } from "./mod.ts";

const apiKey = "secret";

test("workosProbe() sends an authenticated GET /organizations?limit=1", async () => {
  const calls: string[] = [];
  await runProbes([
    workosProbe({
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
    `GET ${workosDefaultBaseUrl}/organizations?limit=1 Bearer secret`,
  ]);
});

test("workosProbe() honours a custom base URL", async () => {
  const calls: string[] = [];
  await runProbes([
    workosProbe({
      apiKey,
      baseUrl: "https://example.test/ignored",
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  assert.deepEqual(calls, ["https://example.test/organizations?limit=1"]);
});

test("workosProbe() reports ok on a 200", async () => {
  const report = await runProbes([
    workosProbe({ apiKey, fetch: fakeFetch({ status: 200 }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "workos");
  assert.equal(report.checks[0].status, "ok");
  assert.equal(report.checks[0].critical, false);
});

test("workosProbe() reports degraded on a non-2xx response", async () => {
  const report = await runProbes([
    workosProbe({ apiKey, fetch: fakeFetch({ status: 401 }) }),
  ]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("workosProbe() makes the report unhealthy when critical", async () => {
  const report = await runProbes([
    workosProbe({ apiKey, critical: true, fetch: fakeFetch({ status: 500 }) }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("workosProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes([
    workosProbe({ apiKey, fetch: hangFetch(track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("workosProbe() names the invalid option at construction", () => {
  assert.throws(
    () => workosProbe({ apiKey, baseUrl: "not a url" }),
    /workosProbe: "baseUrl" must be an absolute URL, got "not a url"/,
  );
  assert.throws(
    () => workosProbe({ apiKey: undefined as unknown as string }),
    /workosProbe: "apiKey" must be a string, got undefined/,
  );
  assert.throws(
    () => workosProbe({ apiKey: "" }),
    /workosProbe: "apiKey" must not be empty/,
  );
});

test("workosProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    workosProbe({
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
