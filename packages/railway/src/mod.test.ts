import assert from "node:assert/strict";
import test from "node:test";
import { createHealthHandler } from "@openstatus/health";
import { railwayExtend, railwayServer } from "./mod.ts";

const fullEnv = {
  RAILWAY_REPLICA_REGION: "us-west2",
  RAILWAY_REPLICA_ID: "9f2c1d0e-5a3b",
  RAILWAY_SERVICE_NAME: "api",
  RAILWAY_DEPLOYMENT_ID: "d6ab8f11-77e2",
  RAILWAY_ENVIRONMENT_NAME: "production",
  RAILWAY_PROJECT_NAME: "openstatus",
  RAILWAY_GIT_COMMIT_SHA: "d0beb8f5c55b36df7d674d55965a23b8d54ad69b",
  RAILWAY_PUBLIC_DOMAIN: "api.up.railway.app",
};

test("railwayServer() maps all six canonical fields", () => {
  assert.deepEqual(railwayServer({ env: fullEnv }), {
    platform: "railway",
    region: "us-west2",
    instanceId: "9f2c1d0e-5a3b",
    service: "api",
    version: "d6ab8f11-77e2",
    environment: "production",
    project: "openstatus",
    commitSha: "d0beb8f5c55b36df7d674d55965a23b8d54ad69b",
  });
});

test("railwayServer() keeps version and commitSha distinct", () => {
  const server = railwayServer({ env: fullEnv });
  assert.equal(server?.version, "d6ab8f11-77e2");
  assert.notEqual(server?.version, server?.commitSha);
});

test("railwayServer() drops the public domain", () => {
  assert.equal(
    "publicDomain" in (railwayServer({ env: fullEnv }) ?? {}),
    false,
  );
});

test("railwayServer() omits absent and empty fields", () => {
  assert.deepEqual(
    railwayServer({
      env: { RAILWAY_REPLICA_ID: "9f2c", RAILWAY_REPLICA_REGION: "" },
    }),
    { platform: "railway", instanceId: "9f2c" },
  );
});

test("railwayServer() omits the requested fields", () => {
  const server = railwayServer({
    env: fullEnv,
    omit: ["commitSha", "project"],
  });
  assert.equal("commitSha" in (server ?? {}), false);
  assert.equal("project" in (server ?? {}), false);
  assert.equal(server?.service, "api");
});

test("railwayExtend() keeps the omitted fields out of the report", () => {
  const extend = railwayExtend({ env: fullEnv, omit: ["commitSha"] });
  assert.deepEqual(extend(), {
    server: railwayServer({ env: fullEnv, omit: ["commitSha"] }),
  });
});

test("railwayServer() falls back to the service name", () => {
  assert.equal(
    railwayServer({ env: { RAILWAY_SERVICE_NAME: "api" } })?.service,
    "api",
  );
});

test("railwayServer() returns undefined off Railway", () => {
  assert.equal(railwayServer({ env: {} }), undefined);
  assert.equal(
    railwayServer({ env: { RAILWAY_ENVIRONMENT_NAME: "production" } }),
    undefined,
  );
});

test("railwayExtend() renders nothing off Railway", () => {
  assert.deepEqual(railwayExtend({ env: {} })(), {});
});

test("railwayExtend() wraps the info under server", () => {
  assert.deepEqual(railwayExtend({ env: fullEnv })(), {
    server: railwayServer({ env: fullEnv }),
  });
});

test("railwayExtend() memoises after the first call", () => {
  const env: Record<string, string | undefined> = {
    RAILWAY_REPLICA_ID: "first",
  };
  const extend = railwayExtend({ env });
  const before = extend();
  env.RAILWAY_REPLICA_ID = "second";
  assert.equal(extend(), before);
});

test("railwayServer() does not throw when process is absent", () => {
  const runtime = globalThis as { process?: { env?: Record<string, string> } };
  const original = runtime.process;
  delete runtime.process;
  try {
    assert.equal(railwayServer(), undefined);
  } finally {
    runtime.process = original;
  }
});

test("the report carries server alongside status and checks", async () => {
  const handler = createHealthHandler({
    probes: [{ name: "noop", run: () => true }],
    extend: railwayExtend({ env: fullEnv }),
  });
  const response = await handler(new Request("https://example.com/health"));
  const body: {
    status: string;
    checks: readonly { name: string }[];
    server?: { region?: string; environment?: string };
  } = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.checks[0].name, "noop");
  assert.equal(body.server?.region, "us-west2");
  assert.equal(body.server?.environment, "production");
});
