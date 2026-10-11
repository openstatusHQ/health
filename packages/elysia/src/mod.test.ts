import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { Elysia } from "elysia";
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

function request(app: Elysia, path: string, method = "GET"): Promise<Response> {
  return app.handle(new Request(`http://localhost${path}`, { method }));
}

test("healthRoute() serves GET /health", async () => {
  const app = new Elysia().use(healthRoute({ probes: [ok] }));
  const res = await request(app, "/health");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.checks[0].name, "a");
});

test("healthRoute() serves HEAD without a body", async () => {
  const app = new Elysia().use(healthRoute({ probes: [bad] }));
  const res = await request(app, "/health", "HEAD");
  assert.equal(res.status, 503);
  assert.equal(await res.text(), "");
});

test("healthRoute() honours a custom path", async () => {
  const app = new Elysia().use(healthRoute({ probes: [ok], path: "/_status" }));
  assert.equal((await request(app, "/_status")).status, 200);
  assert.equal((await request(app, "/health")).status, 404);
});

test("healthRoute() honours status code overrides", async () => {
  const app = new Elysia().use(
    healthRoute({ probes: [bad], unhealthyStatusCode: 200 }),
  );
  const res = await request(app, "/health");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, "unhealthy");
});

test("healthRoute() passes the context to extend", async () => {
  const app = new Elysia().use(
    healthRoute({
      probes: [ok],
      extend: (_report, ctx) => ({
        path: ctx.path,
        requestId: ctx.request.headers.get("x-request-id"),
      }),
    }),
  );
  const res = await app.handle(
    new Request("http://localhost/health", {
      headers: { "x-request-id": "r1" },
    }),
  );
  const body = await res.json();
  assert.equal(body.path, "/health");
  assert.equal(body.requestId, "r1");
});

test("healthRoute() rejects duplicate probe names at construction", () => {
  assert.throws(() => healthRoute({ probes: [ok, ok] }), DuplicateProbeError);
});

test("healthHandler() mounts on a plain route and answers GET and HEAD", async () => {
  const handler = healthHandler({
    probes: [ok],
    extend: (_report, ctx) => ({ requestId: ctx.headers["x-request-id"] }),
  });
  const app = new Elysia().get("/health", handler).head("/health", handler);
  const res = await app.handle(
    new Request("http://localhost/health", {
      headers: { "x-request-id": "r1" },
    }),
  );
  assert.equal(res.status, 200);
  assert.equal((await res.json()).requestId, "r1");
  const head = await app.handle(
    new Request("http://localhost/health", { method: "HEAD" }),
  );
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("healthHandler() types the context from the app's decorators", async () => {
  type Singleton = {
    decorator: { db: string };
    store: Record<never, never>;
    derive: Record<never, never>;
    resolve: Record<never, never>;
  };
  const app = new Elysia().decorate("db", "primary").get(
    "/health",
    healthHandler<Singleton>({
      probes: [ok],
      extend: (_report, ctx) => {
        const db: string = ctx.db;
        return { db };
      },
    }),
  );
  const res = await app.handle(new Request("http://localhost/health"));
  assert.equal((await res.json()).db, "primary");
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
  const app = new Elysia()
    .use(healthRoute({ check, exposeChecks: false }))
    .use(healthRoute({ check, path: "/_health" }));
  const pub = await (await request(app, "/health")).json();
  const ops = await (await request(app, "/_health")).json();
  assert.equal(calls, 1);
  assert.equal(pub.checks, undefined);
  assert.equal(ops.checks.length, 1);
});

test("healthRoute() gates checks per request and survives a throwing extend", async () => {
  const errors: string[] = [];
  const app = new Elysia().use(
    healthRoute({
      probes: [ok],
      exposeChecks: (ctx) => ctx.headers["x-health-token"] === "s3cret",
      extend: () => {
        throw new Error("boom");
      },
      onError: (error) => {
        errors.push(error.message);
      },
    }),
  );
  const anonymous = await (await request(app, "/health")).json();
  assert.equal(anonymous.checks, undefined);
  assert.deepEqual(errors, []);
  const trusted = await app.handle(
    new Request("http://localhost/health", {
      headers: { "x-health-token": "s3cret" },
    }),
  );
  assert.equal(trusted.status, 200);
  assert.equal((await trusted.json()).checks.length, 1);
  assert.deepEqual(errors, ["boom"]);
});
