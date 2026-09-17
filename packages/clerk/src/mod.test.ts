import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import { clerkDefaultBaseUrl, clerkProbe } from "./mod.ts";

const secretKey = "secret";

test("clerkProbe() sends an authenticated GET /v1/users?limit=1", async () => {
  const calls: string[] = [];
  await runProbes([
    clerkProbe({
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
    `GET ${clerkDefaultBaseUrl}/v1/users?limit=1 Bearer secret`,
  ]);
});

test("clerkProbe() honours a custom base URL", async () => {
  const calls: string[] = [];
  await runProbes([
    clerkProbe({
      secretKey,
      baseUrl: "https://example.test/ignored",
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  assert.deepEqual(calls, ["https://example.test/v1/users?limit=1"]);
});

test("clerkProbe() reports ok on a 200", async () => {
  const report = await runProbes([
    clerkProbe({ secretKey, fetch: fakeFetch({ status: 200 }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "clerk");
  assert.equal(report.checks[0].status, "ok");
  assert.equal(report.checks[0].critical, false);
});

test("clerkProbe() reports degraded on a non-2xx response", async () => {
  const report = await runProbes([
    clerkProbe({ secretKey, fetch: fakeFetch({ status: 401 }) }),
  ]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("clerkProbe() makes the report unhealthy when critical", async () => {
  const report = await runProbes([
    clerkProbe({
      secretKey,
      critical: true,
      fetch: fakeFetch({ status: 500 }),
    }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("clerkProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes([
    clerkProbe({ secretKey, fetch: hangFetch(track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("clerkProbe() names the invalid option at construction", () => {
  assert.throws(
    () => clerkProbe({ secretKey, baseUrl: "not a url" }),
    /clerkProbe: "baseUrl" must be an absolute URL, got "not a url"/,
  );
  assert.throws(
    () => clerkProbe({ secretKey: undefined as unknown as string }),
    /clerkProbe: "secretKey" must be a string, got undefined/,
  );
  assert.throws(
    () => clerkProbe({ secretKey: "" }),
    /clerkProbe: "secretKey" must not be empty/,
  );
});

test("clerkProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    clerkProbe({
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
