import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import { upstashProbe } from "./mod.ts";

const url = "https://eu1-example.upstash.io";
const token = "secret";

test("upstashProbe() sends an authenticated GET /ping", async () => {
  const calls: string[] = [];
  await runProbes([
    upstashProbe({
      url,
      token,
      fetch: fakeFetch({
        onFetch: (call) =>
          calls.push(
            `${call.method} ${call.url} ${call.headers.get("authorization")}`,
          ),
      }),
    }),
  ]);
  assert.deepEqual(calls, [`GET ${url}/ping Bearer ${token}`]);
});

test("upstashProbe() reports ok on a 200", async () => {
  const report = await runProbes([
    upstashProbe({ url, token, fetch: fakeFetch({ status: 200 }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "redis");
  assert.equal(report.checks[0].critical, false);
});

test("upstashProbe() reports degraded on a non-2xx response", async () => {
  const report = await runProbes([
    upstashProbe({ url, token, fetch: fakeFetch({ status: 401 }) }),
  ]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
});

test("upstashProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes([
    upstashProbe({ url, token, fetch: hangFetch(track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("upstashProbe() honours overrides", async () => {
  const report = await runProbes([
    upstashProbe({
      url,
      token,
      name: "cache",
      critical: true,
      skip: () => false,
      fetch: fakeFetch({ status: 500 }),
    }),
  ]);
  assert.equal(report.status, "unhealthy");
  assert.equal(report.checks[0].name, "cache");
});

test("upstashProbe() names the missing option at construction", () => {
  assert.throws(
    () => upstashProbe({ url: undefined as unknown as string, token: "t" }),
    /upstashProbe: "url" must be an absolute URL, got undefined/,
  );
  assert.throws(
    () =>
      upstashProbe({
        url: "https://x.upstash.io",
        token: undefined as unknown as string,
      }),
    /upstashProbe: "token" must be a string, got undefined/,
  );
  assert.throws(
    () => upstashProbe({ url: "https://x.upstash.io", token: "" }),
    /upstashProbe: "token" must not be empty/,
  );
});
