import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import { meilisearchProbe } from "./mod.ts";

const host = "http://localhost:7700";
const available = { status: "available" };

test("meilisearchProbe() sends GET /health without credentials by default", async () => {
  const calls: (string | null)[] = [];
  await runProbes([
    meilisearchProbe({
      host,
      fetch: fakeFetch({
        body: available,
        onFetch: (call) =>
          calls.push(
            `${call.method} ${call.url} ${call.headers.get("authorization")}`,
          ),
      }),
    }),
  ]);
  assert.deepEqual(calls, ["GET http://localhost:7700/health null"]);
});

test("meilisearchProbe() sends the API key as a bearer token when given", async () => {
  const calls: (string | null)[] = [];
  await runProbes([
    meilisearchProbe({
      host,
      apiKey: "master",
      fetch: fakeFetch({
        body: available,
        onFetch: (call) => calls.push(call.headers.get("authorization")),
      }),
    }),
  ]);
  assert.deepEqual(calls, ["Bearer master"]);
});

test("meilisearchProbe() reports ok when the status is available", async () => {
  const report = await runProbes([
    meilisearchProbe({ host, fetch: fakeFetch({ body: available }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "search");
  assert.equal(report.checks[0].critical, false);
});

test("meilisearchProbe() fails on another status or a missing body", async () => {
  for (const body of [{ status: "unavailable" }, {}, null]) {
    const report = await runProbes(
      [meilisearchProbe({ host, fetch: fakeFetch({ body }) })],
      { formatError: "message" },
    );
    assert.equal(report.checks[0].status, "failed");
    assert.match(report.checks[0].error ?? "", /unexpected health status/);
  }
});

test("meilisearchProbe() reports degraded on a non-2xx response", async () => {
  const report = await runProbes(
    [meilisearchProbe({ host, fetch: fakeFetch({ status: 503 }) })],
    { formatError: "message" },
  );
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].error, "unexpected status 503");
});

test("meilisearchProbe() makes the report unhealthy when critical", async () => {
  const report = await runProbes([
    meilisearchProbe({
      host,
      critical: true,
      fetch: fakeFetch({ status: 500 }),
    }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("meilisearchProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes([
    meilisearchProbe({ host, fetch: hangFetch(track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("meilisearchProbe() names the invalid option at construction", () => {
  assert.throws(
    () => meilisearchProbe({ host: "not a url" }),
    /meilisearchProbe: "host" must be an absolute URL, got "not a url"/,
  );
  assert.throws(
    () => meilisearchProbe({ host: undefined as unknown as string }),
    /meilisearchProbe: "host" must be an absolute URL, got undefined/,
  );
  assert.throws(
    () => meilisearchProbe({ host, apiKey: "" }),
    /meilisearchProbe: "apiKey" must not be empty/,
  );
});

test("meilisearchProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    meilisearchProbe({
      host,
      name: "meili",
      critical: true,
      skip: () => true,
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "meili");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.deepEqual(calls, []);
});
