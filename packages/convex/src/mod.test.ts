import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { fakeFetch, hangFetch } from "@openstatus/health/testing";
import { convexProbe } from "./mod.ts";

const url = "https://happy-animal-123.convex.cloud";
const path = "health:ping";
const success = { status: "success", value: "pong" };

test("convexProbe() posts the query to /api/query", async () => {
  const calls: string[] = [];
  await runProbes([
    convexProbe({
      url,
      path,
      fetch: fakeFetch({
        body: success,
        onFetch: (call) =>
          calls.push(
            `${call.method} ${call.url} ${call.headers.get("content-type")} ${
              call.headers.get("authorization")
            }`,
          ),
      }),
    }),
  ]);
  assert.deepEqual(calls, [
    `POST ${url}/api/query application/json null`,
  ]);
});

test("convexProbe() sends the token as a bearer token when given", async () => {
  const calls: (string | null)[] = [];
  await runProbes([
    convexProbe({
      url,
      path,
      token: "deploy-key",
      fetch: fakeFetch({
        body: success,
        onFetch: (call) => calls.push(call.headers.get("authorization")),
      }),
    }),
  ]);
  assert.deepEqual(calls, ["Bearer deploy-key"]);
});

test("convexProbe() reports ok on a successful query", async () => {
  const report = await runProbes([
    convexProbe({ url, path, fetch: fakeFetch({ body: success }) }),
  ]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "database");
  assert.equal(report.checks[0].critical, true);
});

test("convexProbe() surfaces a query error", async () => {
  const report = await runProbes(
    [
      convexProbe({
        url,
        path,
        fetch: fakeFetch({
          body: { status: "error", errorMessage: "Could not find function" },
        }),
      }),
    ],
    { formatError: "message" },
  );
  assert.equal(report.status, "unhealthy");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "Could not find function");
});

test("convexProbe() fails on an unexpected body", async () => {
  for (const body of [{ value: 1 }, null]) {
    const report = await runProbes(
      [convexProbe({ url, path, fetch: fakeFetch({ body }) })],
      { formatError: "message" },
    );
    assert.equal(report.checks[0].error, "unexpected response shape");
  }
});

test("convexProbe() fails on a non-2xx response", async () => {
  const report = await runProbes(
    [convexProbe({ url, path, fetch: fakeFetch({ status: 502 }) })],
    { formatError: "message" },
  );
  assert.equal(report.checks[0].error, "unexpected status 502");
});

test("convexProbe() times out and aborts the signal", async () => {
  const track = { aborted: false };
  const report = await runProbes([
    convexProbe({ url, path, fetch: hangFetch(track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.aborted, true);
});

test("convexProbe() names the invalid option at construction", () => {
  assert.throws(
    () => convexProbe({ url: "not a url", path }),
    /convexProbe: "url" must be an absolute URL, got "not a url"/,
  );
  assert.throws(
    () => convexProbe({ url, path: "" }),
    /convexProbe: "path" must not be empty/,
  );
  assert.throws(
    () => convexProbe({ url, path: undefined as unknown as string }),
    /convexProbe: "path" must be a string, got undefined/,
  );
  assert.throws(
    () => convexProbe({ url, path, token: "" }),
    /convexProbe: "token" must not be empty/,
  );
});

test("convexProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    convexProbe({
      url,
      path,
      name: "convex",
      critical: false,
      skip: () => true,
      fetch: fakeFetch({ onFetch: (call) => calls.push(call.url) }),
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "convex");
  assert.equal(check.critical, false);
  assert.equal(check.status, "skipped");
  assert.deepEqual(calls, []);
});
