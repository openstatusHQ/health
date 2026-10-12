import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "vite-plus/test";
import express from "express";
import {
  createHealthCheck,
  DuplicateProbeError,
  type Probe,
} from "@openstatus/health";
import {
  type ExpressHealthOptions,
  healthHandler,
  healthRoute,
} from "./mod.ts";
import type { Express } from "express";

const ok: Probe = { name: "a", run: () => {} };
const bad: Probe = {
  name: "b",
  critical: true,
  run: () => {
    throw new Error("x");
  },
};

async function withServer(
  options: ExpressHealthOptions,
  fn: (base: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(healthRoute(options));
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address == null || typeof address === "string") {
    throw new Error("server has no TCP address");
  }
  const port = address.port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
}

test("healthRoute() serves GET /health", async () => {
  await withServer({ probes: [ok] }, async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.equal(body.checks[0].name, "a");
  });
});

test("healthRoute() serves HEAD without a body", async () => {
  await withServer({ probes: [bad] }, async (base) => {
    const res = await fetch(`${base}/health`, { method: "HEAD" });
    assert.equal(res.status, 503);
    assert.equal(await res.text(), "");
  });
});

test("healthRoute() honours a custom path", async () => {
  await withServer({ probes: [ok], path: "/_status" }, async (base) => {
    assert.equal((await fetch(`${base}/_status`)).status, 200);
    const missing = await fetch(`${base}/health`);
    assert.equal(missing.status, 404);
    await missing.body?.cancel();
  });
});

test("healthRoute() honours status code overrides", async () => {
  await withServer(
    { probes: [bad], unhealthyStatusCode: 200 },
    async (base) => {
      const res = await fetch(`${base}/health`);
      assert.equal(res.status, 200);
      assert.equal((await res.json()).status, "unhealthy");
    },
  );
});

test("healthRoute() passes the request to extend", async () => {
  const options: ExpressHealthOptions = {
    probes: [ok],
    extend: (_report, req) => ({ requestId: String(req.get("x-request-id")) }),
  };
  await withServer(options, async (base) => {
    const res = await fetch(`${base}/health`, {
      headers: { "x-request-id": "r1" },
    });
    assert.equal((await res.json()).requestId, "r1");
  });
});

test("healthRoute() rejects duplicate probe names at construction", () => {
  assert.throws(() => healthRoute({ probes: [ok, ok] }), DuplicateProbeError);
});

test("healthHandler() mounts on a plain route and sees the full request", async () => {
  const app = express();
  app.get(
    "/health",
    healthHandler({
      probes: [ok],
      extend: (_report, req) => ({ ip: req.ip, host: req.hostname }),
    }),
  );
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address == null || typeof address === "string") {
    throw new Error("server has no TCP address");
  }
  try {
    const res = await fetch(`http://127.0.0.1:${address.port}/health`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.ip, "127.0.0.1");
    assert.equal(body.host, "127.0.0.1");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});

async function serve(
  app: Express,
  fn: (base: string) => Promise<void>,
): Promise<void> {
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address == null || typeof address === "string") {
    throw new Error("server has no TCP address");
  }
  try {
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
}

test("healthHandler() types res.locals from the Locals generic", async () => {
  type Locals = { user: string };
  const app = express();
  app.use((_req, res, next) => {
    res.locals.user = "ops";
    next();
  });
  app.get(
    "/health",
    healthHandler<Locals>({
      probes: [ok],
      extend: (_report, req) => {
        const user: string | undefined = req.res?.locals.user;
        return { user };
      },
    }),
  );
  await serve(app, async (base) => {
    const body = await (await fetch(`${base}/health`)).json();
    assert.equal(body.user, "ops");
  });
});

test("healthRoute() shares a prebuilt check and gates checks per request", async () => {
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
  const errors: string[] = [];
  const app = express();
  app.use(healthRoute({ check, exposeChecks: false }));
  app.use(
    healthRoute({
      check,
      path: "/_health",
      exposeChecks: (req) => req.get("x-health-token") === "s3cret",
      extend: () => {
        throw new Error("boom");
      },
      onError: (error) => {
        errors.push(error.message);
      },
    }),
  );
  await serve(app, async (base) => {
    const pub = await (await fetch(`${base}/health`)).json();
    const anonymous = await (await fetch(`${base}/_health`)).json();
    const trusted = await fetch(`${base}/_health`, {
      headers: { "x-health-token": "s3cret" },
    });
    assert.equal(calls, 1);
    assert.equal(pub.checks, undefined);
    assert.equal(anonymous.checks, undefined);
    assert.equal(trusted.status, 200);
    assert.equal((await trusted.json()).checks.length, 1);
    assert.deepEqual(errors, ["boom"]);
  });
});
