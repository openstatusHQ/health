import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import { stripeDefaultBaseUrl, stripeProbe } from "./mod.ts";

const secretKey = "secret";

test("stripeProbe() sends an authenticated GET /v1/balance", async () => {
  const calls: string[] = [];
  await runProbes([
    stripeProbe({
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
    `GET ${stripeDefaultBaseUrl}/v1/balance Bearer secret`,
  ]);
});

test("stripeProbe() honours a custom base URL", async () => {
  const calls: string[] = [];
  await runProbes([
    stripeProbe({
      secretKey,
      baseUrl: "https://example.test/ignored",
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  assert.deepEqual(calls, ["https://example.test/v1/balance"]);
});

test("stripeProbe() reports ok on a 200", async () => {
  const report = await runProbes([
    stripeProbe({ secretKey, fetch: fakeFetch({ status: 200 }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "stripe");
  assert.equal(report.checks[0].status, "ok");
  assert.equal(report.checks[0].critical, false);
});

test("stripeProbe() reports degraded on a non-2xx response", async () => {
  const report = await runProbes([
    stripeProbe({ secretKey, fetch: fakeFetch({ status: 401 }) }),
  ]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("stripeProbe() makes the report unhealthy when critical", async () => {
  const report = await runProbes([
    stripeProbe({
      secretKey,
      critical: true,
      fetch: fakeFetch({ status: 500 }),
    }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("stripeProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes([
    stripeProbe({ secretKey, fetch: hangFetch(track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("stripeProbe() names the invalid option at construction", () => {
  assert.throws(
    () => stripeProbe({ secretKey, baseUrl: "not a url" }),
    /stripeProbe: "baseUrl" must be an absolute URL, got "not a url"/,
  );
  assert.throws(
    () => stripeProbe({ secretKey: undefined as unknown as string }),
    /stripeProbe: "secretKey" must be a string, got undefined/,
  );
  assert.throws(
    () => stripeProbe({ secretKey: "" }),
    /stripeProbe: "secretKey" must not be empty/,
  );
});

test("stripeProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    stripeProbe({
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
