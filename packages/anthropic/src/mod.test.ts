import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import {
  anthropicDefaultBaseUrl,
  anthropicDefaultVersion,
  anthropicProbe,
} from "./mod.ts";

const apiKey = "secret";

test("anthropicProbe() sends GET /v1/models with the api key and version headers", async () => {
  const calls: string[] = [];
  await runProbes([
    anthropicProbe({
      apiKey,
      fetch: fakeFetch({
        onFetch: (call) =>
          calls.push(
            `${call.method} ${call.url} ${call.headers.get("x-api-key")} ${
              call.headers.get("anthropic-version")
            }`,
          ),
      }),
    }),
  ]);
  assert.deepEqual(calls, [
    `GET ${anthropicDefaultBaseUrl}/v1/models secret ${anthropicDefaultVersion}`,
  ]);
});

test("anthropicProbe() honours a custom base URL", async () => {
  const calls: string[] = [];
  await runProbes([
    anthropicProbe({
      apiKey,
      baseUrl: "https://example.test/ignored",
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  assert.deepEqual(calls, ["https://example.test/v1/models"]);
});

test("anthropicProbe() reports ok on a 200", async () => {
  const report = await runProbes([
    anthropicProbe({ apiKey, fetch: fakeFetch({ status: 200 }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "anthropic");
  assert.equal(report.checks[0].status, "ok");
  assert.equal(report.checks[0].critical, false);
});

test("anthropicProbe() reports degraded on a non-2xx response", async () => {
  const report = await runProbes([
    anthropicProbe({ apiKey, fetch: fakeFetch({ status: 401 }) }),
  ]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("anthropicProbe() makes the report unhealthy when critical", async () => {
  const report = await runProbes([
    anthropicProbe({
      apiKey,
      critical: true,
      fetch: fakeFetch({ status: 500 }),
    }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("anthropicProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes([
    anthropicProbe({ apiKey, fetch: hangFetch(track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("anthropicProbe() names the invalid option at construction", () => {
  assert.throws(
    () => anthropicProbe({ apiKey, baseUrl: "not a url" }),
    /anthropicProbe: "baseUrl" must be an absolute URL, got "not a url"/,
  );
  assert.throws(
    () => anthropicProbe({ apiKey: undefined as unknown as string }),
    /anthropicProbe: "apiKey" must be a string, got undefined/,
  );
  assert.throws(
    () => anthropicProbe({ apiKey: "" }),
    /anthropicProbe: "apiKey" must not be empty/,
  );
});

test("anthropicProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    anthropicProbe({
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
