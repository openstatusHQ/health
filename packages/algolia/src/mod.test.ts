import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import { algoliaDsnUrl, algoliaProbe } from "./mod.ts";

const appId = "ABC123";
const apiKey = "search-key";

test("algoliaProbe() sends GET /1/isalive to the DSN host with the app headers", async () => {
  const calls: string[] = [];
  await runProbes([
    algoliaProbe({
      appId,
      apiKey,
      fetch: fakeFetch({
        onFetch: (call) =>
          calls.push(
            `${call.method} ${call.url} ${
              call.headers.get("x-algolia-application-id")
            } ${call.headers.get("x-algolia-api-key")}`,
          ),
      }),
    }),
  ]);
  assert.deepEqual(calls, [
    "GET https://abc123-dsn.algolia.net/1/isalive ABC123 search-key",
  ]);
});

test("algoliaDsnUrl() lowercases the application ID", () => {
  assert.equal(algoliaDsnUrl("XyZ"), "https://xyz-dsn.algolia.net");
});

test("algoliaProbe() honours a custom base URL", async () => {
  const calls: string[] = [];
  await runProbes([
    algoliaProbe({
      appId,
      apiKey,
      baseUrl: "https://abc123.algolia.net/ignored",
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  assert.deepEqual(calls, ["https://abc123.algolia.net/1/isalive"]);
});

test("algoliaProbe() reports ok on a 200", async () => {
  const report = await runProbes([
    algoliaProbe({ appId, apiKey, fetch: fakeFetch({ status: 200 }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "search");
  assert.equal(report.checks[0].critical, false);
});

test("algoliaProbe() reports degraded on a non-2xx response", async () => {
  const report = await runProbes([
    algoliaProbe({ appId, apiKey, fetch: fakeFetch({ status: 403 }) }),
  ]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
});

test("algoliaProbe() makes the report unhealthy when critical", async () => {
  const report = await runProbes([
    algoliaProbe({
      appId,
      apiKey,
      critical: true,
      fetch: fakeFetch({ status: 500 }),
    }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("algoliaProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes([
    algoliaProbe({ appId, apiKey, fetch: hangFetch(track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("algoliaProbe() names the invalid option at construction", () => {
  assert.throws(
    () => algoliaProbe({ appId: "", apiKey }),
    /algoliaProbe: "appId" must not be empty/,
  );
  assert.throws(
    () => algoliaProbe({ appId, apiKey: undefined as unknown as string }),
    /algoliaProbe: "apiKey" must be a string, got undefined/,
  );
  assert.throws(
    () => algoliaProbe({ appId: "not an id", apiKey }),
    /algoliaProbe: "appId" must be alphanumeric, got "not an id"/,
  );
  assert.throws(
    () => algoliaProbe({ appId, apiKey, baseUrl: "not a url" }),
    /algoliaProbe: "baseUrl" must be an absolute URL, got "not a url"/,
  );
});

test("algoliaProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    algoliaProbe({
      appId,
      apiKey,
      name: "algolia",
      critical: true,
      skip: () => true,
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "algolia");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.deepEqual(calls, []);
});
