import assert from "node:assert/strict";
import test from "node:test";
import { renderHealthResponse, statusCodeFor } from "./response.ts";
import type { HealthReport } from "./types.ts";

const report = (status: HealthReport["status"]): HealthReport => ({
  status,
  checkedAt: "2026-09-11T00:00:00.000Z",
  latencyMs: 12,
  checks: [{ name: "db", status: "ok", critical: true, latencyMs: 3 }],
});

test("statusCodeFor() maps statuses to defaults", () => {
  assert.equal(statusCodeFor(report("ok"), {}), 200);
  assert.equal(statusCodeFor(report("degraded"), {}), 200);
  assert.equal(statusCodeFor(report("unhealthy"), {}), 503);
});

test("statusCodeFor() honours overrides", () => {
  const options = {
    unhealthyStatusCode: 200,
    degradedStatusCode: 299,
  };
  assert.equal(statusCodeFor(report("unhealthy"), options), 200);
  assert.equal(statusCodeFor(report("degraded"), options), 299);
});

test("renderHealthResponse() exposes checks by default", () => {
  const res = renderHealthResponse(report("ok"), {}, {
    checks: [{ name: "private-db", status: "unhealthy" }],
    latencyMs: 999,
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal(res.headers["content-type"], "application/json; charset=utf-8");
  assert.deepEqual(res.body, {
    status: "ok",
    checkedAt: "2026-09-11T00:00:00.000Z",
    latencyMs: 12,
    checks: [{ name: "db", status: "ok", critical: true, latencyMs: 3 }],
  });
});

test("renderHealthResponse() hides checks and latency when exposeChecks is false", () => {
  const res = renderHealthResponse(report("degraded"), {
    exposeChecks: false,
  });
  assert.deepEqual(res.body, {
    status: "degraded",
    checkedAt: "2026-09-11T00:00:00.000Z",
  });
});

test("renderHealthResponse() hides extension checks and latency but keeps other fields", () => {
  const res = renderHealthResponse(report("ok"), {
    exposeChecks: false,
  }, {
    region: "fra",
    status: "hacked",
    checkedAt: "hacked",
    checks: [{ name: "private-db", status: "unhealthy" }],
    latencyMs: 999,
  });
  assert.deepEqual(res.body, {
    region: "fra",
    status: "ok",
    checkedAt: "2026-09-11T00:00:00.000Z",
  });
});

test("renderHealthResponse() accepts interface-typed and Date fields", () => {
  interface Vitals {
    readonly rss: number;
  }
  const vitals: Vitals = { rss: 1 };
  const res = renderHealthResponse(report("ok"), { exposeChecks: false }, {
    vitals,
    at: new Date("2026-09-11T00:00:00.000Z"),
  });
  assert.equal(
    JSON.stringify(res.body),
    '{"vitals":{"rss":1},"at":"2026-09-11T00:00:00.000Z","status":"ok","checkedAt":"2026-09-11T00:00:00.000Z"}',
  );
});

for (const exposeChecks of [true, false]) {
  test(`renderHealthResponse() ignores top-level toJSON with exposeChecks=${exposeChecks}`, () => {
    const extended = Object.freeze({
      toJSON: () => ({ status: "ok" }),
      at: new Date("2026-09-11T00:00:00.000Z"),
      server: { toJSON: () => ({ region: "fra" }) },
    });
    const res = renderHealthResponse(
      report("unhealthy"),
      { exposeChecks },
      extended,
    );
    assert.equal(res.status, 503);
    assert.deepEqual(JSON.parse(JSON.stringify(res.body)), {
      at: "2026-09-11T00:00:00.000Z",
      server: { region: "fra" },
      status: "unhealthy",
      checkedAt: "2026-09-11T00:00:00.000Z",
      ...(exposeChecks
        ? {
          latencyMs: 12,
          checks: [{ name: "db", status: "ok", critical: true, latencyMs: 3 }],
        }
        : {}),
    });
  });
}
