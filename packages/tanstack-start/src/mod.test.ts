import assert from "node:assert/strict";
import test from "node:test";
import { createRootRoute, createRoute } from "@tanstack/react-router";
import type {} from "@tanstack/start-client-core";
import type { Probe } from "@openstatus/health";
import { healthHandler, healthRoute, type StartHandlerContext } from "./mod.ts";

const ok: Probe = { name: "a", run: () => {} };
const bad: Probe = {
  name: "b",
  critical: true,
  run: () => {
    throw new Error("x");
  },
};

function ctx(
  url = "http://localhost/api/health",
  init?: RequestInit,
): StartHandlerContext {
  return { request: new Request(url, init), params: {}, context: {} };
}

test("healthRoute() exposes GET and HEAD handlers", async () => {
  const { GET, HEAD } = healthRoute({ probes: [ok] });
  const res = await GET(ctx());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal((await res.json()).status, "ok");
  const head = await HEAD(ctx(undefined, { method: "HEAD" }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("healthRoute() maps unhealthy to 503", async () => {
  const { GET } = healthRoute({ probes: [bad] });
  assert.equal((await GET(ctx())).status, 503);
});

test("healthHandler() answers GET and HEAD on its own", async () => {
  const handler = healthHandler({ probes: [ok] });
  const res = await handler(ctx());
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, "ok");
  const head = await handler(ctx(undefined, { method: "HEAD" }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("extend receives the request, params and context", async () => {
  const { GET } = healthRoute<{ requestId: string }>({
    probes: [ok],
    extend: (_report, { request, params, context }) => ({
      path: new URL(request.url).pathname,
      params,
      requestId: context.requestId,
    }),
  });
  const body = await (await GET({
    request: new Request("http://localhost/api/health"),
    params: { id: "1" },
    context: { requestId: "r1" },
  })).json();
  assert.equal(body.path, "/api/health");
  assert.deepEqual(body.params, { id: "1" });
  assert.equal(body.requestId, "r1");
});

test("typed context catches typos", () => {
  healthRoute<{ requestId: string }>({
    probes: [ok],
    // @ts-expect-error requestID is not a key of the context
    extend: (_report, { context }) => ({ id: context.requestID }),
  });
});

test("handlers fit a TanStack Start server route", () => {
  const root = createRootRoute();
  const route = createRoute({
    getParentRoute: () => root,
    path: "/api/health",
    server: { handlers: healthRoute({ probes: [ok] }) },
  });
  assert.equal(typeof route.options.server?.handlers, "object");
  const withMiddleware = createRoute({
    getParentRoute: () => root,
    path: "/api/health",
    server: {
      handlers: ({ createHandlers }) =>
        createHandlers({
          GET: { handler: healthHandler({ probes: [ok] }) },
          HEAD: healthHandler({ probes: [ok] }),
        }),
    },
  });
  assert.equal(typeof withMiddleware.options.server?.handlers, "function");
});

test("a typed context is rejected by a route that does not provide it", () => {
  createRoute({
    getParentRoute: () => createRootRoute(),
    path: "/api/health",
    server: {
      // @ts-expect-error the route has no middleware providing requestId
      handlers: healthRoute<{ requestId: string }>({ probes: [ok] }),
    },
  });
});
