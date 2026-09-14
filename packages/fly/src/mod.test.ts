import assert from "node:assert/strict";
import test from "node:test";
import { createHealthHandler } from "@openstatus/health";
import { flyExtend, flyServer } from "./mod.ts";

const fullEnv = {
  FLY_REGION: "ams",
  FLY_MACHINE_ID: "148e21ebd47089",
  FLY_ALLOC_ID: "148e21ebd47089",
  FLY_APP_NAME: "openstatus-api",
  FLY_IMAGE_REF: "registry.fly.io/openstatus-api:deployment-01H9RK9EYO",
  PRIMARY_REGION: "cdg",
  FLY_PROCESS_GROUP: "app",
  FLY_MACHINE_VERSION: "01H9RKA2WPYNA",
  FLY_VM_MEMORY_MB: "256",
};

test("flyServer() maps every field", () => {
  assert.deepEqual(flyServer({ env: fullEnv }), {
    platform: "fly",
    region: "ams",
    instanceId: "148e21ebd47089",
    service: "openstatus-api",
    version: "registry.fly.io/openstatus-api:deployment-01H9RK9EYO",
    primaryRegion: "cdg",
    processGroup: "app",
    machineVersion: "01H9RKA2WPYNA",
    memoryMb: 256,
  });
});

test("flyServer() reports memoryMb as a number and omits it when unparseable", () => {
  const parsed = flyServer({ env: fullEnv });
  assert.equal(typeof parsed?.memoryMb, "number");
  const unparseable = flyServer({
    env: { ...fullEnv, FLY_VM_MEMORY_MB: "lots" },
  });
  assert.equal("memoryMb" in (unparseable ?? {}), false);
});

test("flyServer() omits absent and empty fields", () => {
  const server = flyServer({
    env: { FLY_MACHINE_ID: "148e21ebd47089", FLY_REGION: "" },
  });
  assert.deepEqual(server, {
    platform: "fly",
    instanceId: "148e21ebd47089",
  });
});

test("flyServer() omits the requested fields", () => {
  const server = flyServer({ env: fullEnv, omit: ["instanceId", "version"] });
  assert.equal("instanceId" in (server ?? {}), false);
  assert.equal("version" in (server ?? {}), false);
  assert.equal(server?.region, "ams");
});

test("flyExtend() keeps the omitted fields out of the report", () => {
  const extend = flyExtend({ env: fullEnv, omit: ["instanceId"] });
  assert.deepEqual(extend(), {
    server: flyServer({ env: fullEnv, omit: ["instanceId"] }),
  });
});

test("flyServer() falls back to FLY_ALLOC_ID and FLY_APP_NAME", () => {
  assert.equal(
    flyServer({ env: { FLY_ALLOC_ID: "0e28", FLY_APP_NAME: "api" } })
      ?.instanceId,
    "0e28",
  );
  assert.equal(flyServer({ env: { FLY_APP_NAME: "api" } })?.service, "api");
});

test("flyServer() returns undefined off Fly", () => {
  assert.equal(flyServer({ env: {} }), undefined);
  assert.equal(flyServer({ env: { HOME: "/root" } }), undefined);
});

test("flyExtend() renders nothing off Fly", () => {
  assert.deepEqual(flyExtend({ env: {} })(), {});
});

test("flyExtend() wraps the info under server", () => {
  assert.deepEqual(flyExtend({ env: fullEnv })(), {
    server: flyServer({ env: fullEnv }),
  });
});

test("flyExtend() memoises after the first call", () => {
  const env: Record<string, string | undefined> = {
    FLY_MACHINE_ID: "first",
  };
  const extend = flyExtend({ env });
  const before = extend();
  env.FLY_MACHINE_ID = "second";
  assert.equal(extend(), before);
});

test("flyServer() does not throw when process is absent", () => {
  const runtime = globalThis as { process?: { env?: Record<string, string> } };
  const original = runtime.process;
  delete runtime.process;
  try {
    assert.equal(flyServer(), undefined);
  } finally {
    runtime.process = original;
  }
});

test("the report carries server alongside status and checks", async () => {
  const handler = createHealthHandler({
    probes: [{ name: "noop", run: () => true }],
    extend: flyExtend({ env: fullEnv }),
  });
  const response = await handler(new Request("https://example.com/health"));
  const body: {
    status: string;
    checks: readonly { name: string }[];
    server?: { region?: string; platform?: string };
  } = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.checks[0].name, "noop");
  assert.equal(body.server?.platform, "fly");
  assert.equal(body.server?.region, "ams");
});
