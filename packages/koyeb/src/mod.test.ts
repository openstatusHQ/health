import assert from "node:assert/strict";
import test from "node:test";
import { createHealthHandler } from "@openstatus/health";
import { koyebExtend, koyebServer } from "./mod.ts";

const fullEnv = {
  KOYEB_REGION: "fra",
  KOYEB_INSTANCE_ID: "e5f296b6-a911-8637-234e-f929e8bd5d87",
  KOYEB_SERVICE_NAME: "my-service",
  KOYEB_REGIONAL_DEPLOYMENT_ID: "3a1bb3d0-7502-40a5-ae12-7e28f807531b",
  KOYEB_APP_NAME: "app",
  KOYEB_DC: "fra1",
  KOYEB_REPLICA_INDEX: "0",
  KOYEB_INSTANCE_TYPE: "nano",
  KOYEB_APP_ID: "647813c7-09b8-44ce-a02a-0cc70092bf4c",
  KOYEB_SERVICE_ID: "41dcf9cb-53a4-4b02-960c-f421254a1678",
  KOYEB_ORGANIZATION_ID: "6704aff2-36ec-4e13-ba1e-0438eaf7a65e",
  KOYEB_ORGANIZATION_NAME: "my-organization",
  KOYEB_HYPERVISOR_ID: "fra1-rn23u23",
  KOYEB_PUBLIC_DOMAIN: "app-org-hash.koyeb.app",
  KOYEB_SERVICE_PRIVATE_DOMAIN: "my-service.app.internal",
  KOYEB_INSTANCE_MEMORY_MB: "256",
};

test("koyebServer() maps every curated field", () => {
  assert.deepEqual(koyebServer({ env: fullEnv }), {
    platform: "koyeb",
    region: "fra",
    instanceId: "e5f296b6-a911-8637-234e-f929e8bd5d87",
    service: "my-service",
    version: "3a1bb3d0-7502-40a5-ae12-7e28f807531b",
    app: "app",
    datacenter: "fra1",
    replicaIndex: 0,
    instanceType: "nano",
  });
});

test("koyebServer() drops internal ids, the hypervisor and both domains", () => {
  const server = koyebServer({ env: fullEnv }) ?? {};
  for (
    const key of [
      "appId",
      "serviceId",
      "organizationId",
      "organizationName",
      "hypervisorId",
      "publicDomain",
      "privateDomain",
    ]
  ) {
    assert.equal(key in server, false, `${key} should not be rendered`);
  }
});

test("koyebServer() reports replicaIndex as a number, including zero", () => {
  assert.equal(koyebServer({ env: fullEnv })?.replicaIndex, 0);
  const unparseable = koyebServer({
    env: { ...fullEnv, KOYEB_REPLICA_INDEX: "first" },
  });
  assert.equal("replicaIndex" in (unparseable ?? {}), false);
});

test("koyebServer() omits absent and empty fields", () => {
  assert.deepEqual(
    koyebServer({ env: { KOYEB_INSTANCE_ID: "e5f2", KOYEB_REGION: "" } }),
    { platform: "koyeb", instanceId: "e5f2" },
  );
});

test("koyebServer() omits the requested fields", () => {
  const server = koyebServer({ env: fullEnv, omit: ["instanceId", "app"] });
  assert.equal("instanceId" in (server ?? {}), false);
  assert.equal("app" in (server ?? {}), false);
  assert.equal(server?.region, "fra");
});

test("koyebExtend() keeps the omitted fields out of the report", () => {
  const extend = koyebExtend({ env: fullEnv, omit: ["instanceId"] });
  assert.deepEqual(extend(), {
    server: koyebServer({ env: fullEnv, omit: ["instanceId"] }),
  });
});

test("koyebServer() returns undefined off Koyeb", () => {
  assert.equal(koyebServer({ env: {} }), undefined);
  assert.equal(koyebServer({ env: { KOYEB_REGION: "fra" } }), undefined);
});

test("koyebExtend() renders nothing off Koyeb", () => {
  assert.deepEqual(koyebExtend({ env: {} })(), {});
});

test("koyebExtend() wraps the info under server", () => {
  assert.deepEqual(koyebExtend({ env: fullEnv })(), {
    server: koyebServer({ env: fullEnv }),
  });
});

test("koyebExtend() memoises after the first call", () => {
  const env: Record<string, string | undefined> = {
    KOYEB_INSTANCE_ID: "first",
  };
  const extend = koyebExtend({ env });
  const before = extend();
  env.KOYEB_INSTANCE_ID = "second";
  assert.equal(extend(), before);
});

test("koyebServer() does not throw when process is absent", () => {
  const runtime = globalThis as { process?: { env?: Record<string, string> } };
  const original = runtime.process;
  delete runtime.process;
  try {
    assert.equal(koyebServer(), undefined);
  } finally {
    runtime.process = original;
  }
});

test("the report carries server alongside status and checks", async () => {
  const handler = createHealthHandler({
    probes: [{ name: "noop", run: () => true }],
    extend: koyebExtend({ env: fullEnv }),
  });
  const response = await handler(new Request("https://example.com/health"));
  const body: {
    status: string;
    checks: readonly { name: string }[];
    server?: { region?: string; platform?: string };
  } = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.checks[0].name, "noop");
  assert.equal(body.server?.platform, "koyeb");
  assert.equal(body.server?.region, "fra");
});
