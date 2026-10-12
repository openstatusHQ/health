import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { NextRequest } from "next/server.js";
import type { Probe } from "@openstatus/health";
import { healthRoute } from "./mod.ts";

const ok: Probe = { name: "a", run: () => {} };
const bad: Probe = {
  name: "b",
  critical: true,
  run: () => {
    throw new Error("x");
  },
};

test("healthRoute() exposes GET and HEAD handlers", async () => {
  const { GET, HEAD } = healthRoute({ probes: [ok] });
  const res = await GET(new NextRequest("http://localhost/health"));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal((await res.json()).status, "ok");
  const head = await HEAD(
    new NextRequest("http://localhost/health", { method: "HEAD" }),
  );
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("healthRoute() maps unhealthy to 503", async () => {
  const { GET } = healthRoute({ probes: [bad] });
  assert.equal(
    (await GET(new NextRequest("http://localhost/health"))).status,
    503,
  );
});

test("healthRoute() passes the NextRequest to extend", async () => {
  const { GET } = healthRoute({
    probes: [ok],
    extend: (_report, req) => ({ path: req.nextUrl.pathname }),
  });
  const body = await (
    await GET(new NextRequest("http://localhost/api/health"))
  ).json();
  assert.equal(body.path, "/api/health");
});
