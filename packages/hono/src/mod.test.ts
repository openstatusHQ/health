import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { type Env, Hono } from "hono";
import {
  createHealthCheck,
  DuplicateProbeError,
  type Probe,
} from "@openstatus/health";
import { healthHandler, healthRoute } from "./mod.ts";

const ok: Probe = { name: "a", run: () => {} };
const bad: Probe = {
  name: "b",
  critical: true,
  run: () => {
    throw new Error("x");
  },
};

function app<E extends Env>(route: Hono<E>): Hono {
  return new Hono().route("/", route);
}

test("healthRoute() serves GET /health", async () => {
  const res = await app(healthRoute({ probes: [ok] })).request("/health");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.checks[0].name, "a");
});

test("healthRoute() matches a trailing slash", async () => {
  const res = await app(healthRoute({ probes: [ok] })).request("/health/");
  assert.equal(res.status, 200);
});

test("healthRoute() serves HEAD without a body", async () => {
  const res = await app(healthRoute({ probes: [bad] })).request("/health", {
    method: "HEAD",
  });
  assert.equal(res.status, 503);
  assert.equal(await res.text(), "");
});

test("healthRoute() honours a custom path", async () => {
  const a = app(healthRoute({ probes: [ok], path: "/_status" }));
  assert.equal((await a.request("/_status")).status, 200);
  assert.equal((await a.request("/health")).status, 404);
});

test("healthRoute() maps unhealthy to 503 by default and honours overrides", async () => {
  assert.equal(
    (await app(healthRoute({ probes: [bad] })).request("/health")).status,
    503,
  );
  const res = await app(
    healthRoute({ probes: [bad], unhealthyStatusCode: 200 }),
  ).request("/health");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, "unhealthy");
});

test("healthRoute() passes the Hono context to extend", async () => {
  const route = healthRoute({
    probes: [ok],
    extend: (_report, c) => ({ requestId: c.req.header("x-request-id") }),
  });
  const res = await app(route).request("/health", {
    headers: { "x-request-id": "r1" },
  });
  assert.equal((await res.json()).requestId, "r1");
});

test("healthRoute() rejects duplicate probe names at construction", () => {
  assert.throws(() => healthRoute({ probes: [ok, ok] }), DuplicateProbeError);
});

test("healthHandler() mounts on a plain route and answers GET and HEAD", async () => {
  const a = new Hono().on(
    ["GET", "HEAD"],
    "/health",
    healthHandler({
      probes: [ok],
      extend: (_report, c) => ({ requestId: c.req.header("x-request-id") }),
    }),
  );
  const res = await a.request("/health", { headers: { "x-request-id": "r1" } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).requestId, "r1");
  const head = await a.request("/health", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("healthHandler() types the context from the app's Env", async () => {
  type Env = { Variables: { requestId: string } };
  const a = new Hono<Env>();
  a.use(async (c, next) => {
    c.set("requestId", "r2");
    await next();
  });
  a.on(
    ["GET", "HEAD"],
    "/health",
    healthHandler<Env>({
      probes: [ok],
      extend: (_report, c) => {
        const id: string = c.get("requestId");
        return { requestId: id };
      },
    }),
  );
  a.route("/", healthRoute<Env>({ probes: [ok], path: "/h2" }));
  const res = await a.request("/health");
  assert.equal((await res.json()).requestId, "r2");
});

test("healthRoute() shares a prebuilt check between two routes", async () => {
  let calls = 0;
  const check = createHealthCheck({
    probes: [
      {
        name: "a",
        run: () => {
          calls++;
        },
      },
    ],
    cacheMs: 1000,
  });
  const a = new Hono()
    .route("/", healthRoute({ check, exposeChecks: false }))
    .route("/", healthRoute({ check, path: "/_health" }));
  const pub = await (await a.request("/health")).json();
  const ops = await (await a.request("/_health")).json();
  assert.equal(calls, 1);
  assert.equal(pub.checks, undefined);
  assert.equal(ops.checks.length, 1);
});

test("healthRoute() gates checks and extend per request", async () => {
  const a = app(
    healthRoute({
      probes: [ok],
      exposeChecks: (c) => c.req.header("x-health-token") === "s3cret",
      extend: () => ({ region: "fra" }),
    }),
  );
  const anonymous = await (await a.request("/health")).json();
  assert.equal(anonymous.checks, undefined);
  assert.equal(anonymous.region, undefined);
  const trusted = await (
    await a.request("/health", {
      headers: { "x-health-token": "s3cret" },
    })
  ).json();
  assert.equal(trusted.checks.length, 1);
  assert.equal(trusted.region, "fra");
});

test("healthRoute() still answers when extend throws", async () => {
  const errors: string[] = [];
  const a = app(
    healthRoute({
      probes: [ok],
      extend: () => {
        throw new Error("boom");
      },
      onError: (error) => {
        errors.push(error.message);
      },
    }),
  );
  const res = await a.request("/health");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, "ok");
  assert.deepEqual(errors, ["boom"]);
});
