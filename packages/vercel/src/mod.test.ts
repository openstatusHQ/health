import assert from "node:assert/strict";
import test from "node:test";
import { createHealthHandler } from "@openstatus/health";
import { vercelExtend, vercelServer } from "./mod.ts";

const fullEnv = {
  VERCEL: "1",
  VERCEL_REGION: "cdg1",
  VERCEL_ENV: "production",
  VERCEL_DEPLOYMENT_ID: "dpl_7Gw5ZMBpQA8h9GF832KGp7nwbuh3",
  VERCEL_PROJECT_ID: "prj_Rej9WaMNRbffVm34MfDqa4daCEvZzzE",
  VERCEL_TARGET_ENV: "production",
  VERCEL_GIT_COMMIT_SHA: "fa1eade47b73733d6312d5abfad33ce9e4068081",
  VERCEL_GIT_COMMIT_REF: "improve-about-page",
  VERCEL_URL: "my-site.vercel.app",
};

test("vercelServer() maps every curated field", () => {
  assert.deepEqual(vercelServer({ env: fullEnv }), {
    platform: "vercel",
    region: "cdg1",
    environment: "production",
    version: "dpl_7Gw5ZMBpQA8h9GF832KGp7nwbuh3",
    projectId: "prj_Rej9WaMNRbffVm34MfDqa4daCEvZzzE",
    targetEnvironment: "production",
    commitSha: "fa1eade47b73733d6312d5abfad33ce9e4068081",
    branch: "improve-about-page",
  });
});

test("vercelServer() renders no service and no instanceId", () => {
  const server = vercelServer({ env: fullEnv }) ?? {};
  assert.equal("service" in server, false);
  assert.equal("instanceId" in server, false);
});

test("vercelServer() reports the project id under its own name", () => {
  const server = vercelServer({ env: fullEnv });
  assert.equal(server?.projectId, "prj_Rej9WaMNRbffVm34MfDqa4daCEvZzzE");
});

test("vercelServer() omits the requested fields", () => {
  const server = vercelServer({ env: fullEnv, omit: ["projectId"] });
  assert.equal("projectId" in (server ?? {}), false);
  assert.equal(server?.region, "cdg1");
  assert.equal(server?.commitSha, "fa1eade47b73733d6312d5abfad33ce9e4068081");
});

test("vercelServer() can omit the platform itself", () => {
  const server = vercelServer({ env: fullEnv, omit: ["platform"] });
  // @ts-expect-error `platform` was omitted, so it is gone from the result type
  server?.platform;
  assert.equal("platform" in (server ?? {}), false);
});

test("vercelExtend() keeps the omitted fields out of the report", () => {
  const extend = vercelExtend({ env: fullEnv, omit: ["projectId"] });
  assert.deepEqual(extend(), {
    server: vercelServer({ env: fullEnv, omit: ["projectId"] }),
  });
});

test("vercelServer() survives a project with system variables disabled", () => {
  assert.deepEqual(vercelServer({ env: { VERCEL: "1" } }), {
    platform: "vercel",
  });
});

test("vercelServer() omits the region when read outside the runtime", () => {
  const built = { ...fullEnv, VERCEL_REGION: undefined };
  assert.equal("region" in (vercelServer({ env: built }) ?? {}), false);
});

test("vercelServer() returns undefined off Vercel", () => {
  assert.equal(vercelServer({ env: {} }), undefined);
  assert.equal(vercelServer({ env: { VERCEL_REGION: "cdg1" } }), undefined);
});

test("vercelExtend() renders nothing off Vercel", () => {
  assert.deepEqual(vercelExtend({ env: {} })(), {});
});

test("vercelExtend() wraps the info under server", () => {
  assert.deepEqual(vercelExtend({ env: fullEnv })(), {
    server: vercelServer({ env: fullEnv }),
  });
});

test("vercelExtend() memoises after the first call", () => {
  const env: Record<string, string | undefined> = {
    VERCEL: "1",
    VERCEL_REGION: "cdg1",
  };
  const extend = vercelExtend({ env });
  const before = extend();
  env.VERCEL_REGION = "iad1";
  assert.equal(extend(), before);
});

test("vercelServer() does not throw when process is absent", () => {
  const runtime = globalThis as { process?: { env?: Record<string, string> } };
  const original = runtime.process;
  delete runtime.process;
  try {
    assert.equal(vercelServer(), undefined);
  } finally {
    runtime.process = original;
  }
});

test("the report carries server alongside status and checks", async () => {
  const handler = createHealthHandler({
    probes: [{ name: "noop", run: () => true }],
    extend: vercelExtend({ env: fullEnv }),
  });
  const response = await handler(new Request("https://example.com/health"));
  const body: {
    status: string;
    checks: readonly { name: string }[];
    server?: { region?: string; environment?: string };
  } = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.checks[0].name, "noop");
  assert.equal(body.server?.region, "cdg1");
  assert.equal(body.server?.environment, "production");
});
