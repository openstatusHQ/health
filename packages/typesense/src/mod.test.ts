import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import { typesenseProbe } from "./mod.ts";

const host = "http://localhost:8108";
const healthy = { ok: true };

test("typesenseProbe() sends GET /health without credentials by default", async () => {
  const calls: (string | null)[] = [];
  await runProbes([
    typesenseProbe({
      host,
      fetch: fakeFetch({
        body: healthy,
        onFetch: (call) =>
          calls.push(
            `${call.method} ${call.url} ${
              call.headers.get("x-typesense-api-key")
            }`,
          ),
      }),
    }),
  ]);
  assert.deepEqual(calls, ["GET http://localhost:8108/health null"]);
});

test("typesenseProbe() sends the API key header when given", async () => {
  const calls: (string | null)[] = [];
  await runProbes([
    typesenseProbe({
      host,
      apiKey: "xyz",
      fetch: fakeFetch({
        body: healthy,
        onFetch: (call) => calls.push(call.headers.get("x-typesense-api-key")),
      }),
    }),
  ]);
  assert.deepEqual(calls, ["xyz"]);
});

test("typesenseProbe() reports ok when the body says ok", async () => {
  const report = await runProbes([
    typesenseProbe({ host, fetch: fakeFetch({ body: healthy }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "search");
  assert.equal(report.checks[0].critical, false);
});

test("typesenseProbe() fails when ok is false or the body is missing", async () => {
  for (const body of [{ ok: false }, {}, null]) {
    const report = await runProbes(
      [typesenseProbe({ host, fetch: fakeFetch({ body }) })],
      { formatError: "message" },
    );
    assert.equal(report.checks[0].status, "failed");
    assert.match(report.checks[0].error ?? "", /unexpected health body/);
  }
});

test("typesenseProbe() reports degraded on a non-2xx response", async () => {
  const report = await runProbes(
    [typesenseProbe({ host, fetch: fakeFetch({ status: 503 }) })],
    { formatError: "message" },
  );
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].error, "unexpected status 503");
});

test("typesenseProbe() makes the report unhealthy when critical", async () => {
  const report = await runProbes([
    typesenseProbe({ host, critical: true, fetch: fakeFetch({ status: 500 }) }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("typesenseProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes([
    typesenseProbe({ host, fetch: hangFetch(track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("typesenseProbe() names the invalid option at construction", () => {
  assert.throws(
    () => typesenseProbe({ host: "not a url" }),
    /typesenseProbe: "host" must be an absolute URL, got "not a url"/,
  );
  assert.throws(
    () => typesenseProbe({ host: undefined as unknown as string }),
    /typesenseProbe: "host" must be an absolute URL, got undefined/,
  );
  assert.throws(
    () => typesenseProbe({ host, apiKey: "" }),
    /typesenseProbe: "apiKey" must not be empty/,
  );
});

test("typesenseProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    typesenseProbe({
      host,
      name: "typesense",
      critical: true,
      skip: () => true,
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "typesense");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.deepEqual(calls, []);
});
