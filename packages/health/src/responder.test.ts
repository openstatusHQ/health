import assert from "node:assert/strict";
import test from "node:test";
import { createHealthCheck } from "./check.ts";
import { createHealthResponder, resolveHealthCheck } from "./responder.ts";
import { failingProbe, okProbe } from "./testing.ts";

type Ctx = { readonly token?: string };

test("createHealthResponder() renders a report for a context", async () => {
  const responder = createHealthResponder<Ctx>({ probes: [okProbe("a")] });
  const rendered = await responder.respond({});
  assert.equal(rendered.status, 200);
  assert.equal(rendered.body.status, "ok");
  assert.equal(rendered.body.checks?.[0].name, "a");
});

test("createHealthResponder() exposes the check it built", async () => {
  let calls = 0;
  const responder = createHealthResponder<Ctx>({
    probes: [{
      name: "a",
      run: () => {
        calls++;
      },
    }],
    cacheMs: 1000,
  });
  await responder.respond({});
  responder.check.invalidate();
  await responder.respond({});
  assert.equal(calls, 2);
});

test("createHealthResponder() accepts a prebuilt check", async () => {
  let calls = 0;
  const check = createHealthCheck({
    probes: [{
      name: "a",
      run: () => {
        calls++;
      },
    }],
    cacheMs: 1000,
  });
  const internal = createHealthResponder<Ctx>({ check });
  const external = createHealthResponder<Ctx>({ check, exposeChecks: false });
  const a = await internal.respond({});
  const b = await external.respond({});
  assert.equal(calls, 1);
  assert.equal(a.body.checks?.length, 1);
  assert.equal(b.body.checks, undefined);
  assert.equal(resolveHealthCheck({ check }), check);
});

test("createHealthResponder() resolves exposeChecks per request", async () => {
  const responder = createHealthResponder<Ctx>({
    probes: [okProbe("a")],
    exposeChecks: (ctx) => ctx.token === "secret",
    extend: () => ({ region: "fra" }),
  });
  const anonymous = await responder.respond({});
  assert.deepEqual(Object.keys(anonymous.body), ["status", "checkedAt"]);
  const trusted = await responder.respond({ token: "secret" });
  assert.equal(trusted.body.checks?.length, 1);
  assert.equal(trusted.body.region, "fra");
});

test("createHealthResponder() awaits an async exposeChecks", async () => {
  const responder = createHealthResponder<Ctx>({
    probes: [okProbe("a")],
    exposeChecks: () => Promise.resolve(false),
  });
  const rendered = await responder.respond({});
  assert.equal(rendered.body.checks, undefined);
});

test("createHealthResponder() hides extend output when checks are hidden", async () => {
  let ran = false;
  const responder = createHealthResponder<Ctx>({
    probes: [okProbe("a")],
    exposeChecks: false,
    extend: () => {
      ran = true;
      return { secret: "x" };
    },
  });
  const rendered = await responder.respond({});
  assert.equal(rendered.body.secret, undefined);
  assert.equal(ran, false);
});

test("createHealthResponder() answers without the extension when extend throws", async () => {
  const errors: string[] = [];
  const responder = createHealthResponder<Ctx>({
    probes: [failingProbe("a", true)],
    extend: () => {
      throw new Error("boom");
    },
    onError: (error) => {
      errors.push(error.message);
    },
  });
  const rendered = await responder.respond({});
  assert.equal(rendered.status, 503);
  assert.equal(rendered.body.status, "unhealthy");
  assert.equal(rendered.body.checks?.length, 1);
  assert.deepEqual(errors, ["boom"]);
});

test("createHealthResponder() reports a rejected extend and a thrown onError", async () => {
  const responder = createHealthResponder<Ctx>({
    probes: [okProbe("a")],
    extend: () => Promise.reject(new Error("later")),
    onError: () => {
      throw new Error("logger down");
    },
  });
  const rendered = await responder.respond({});
  assert.equal(rendered.body.status, "ok");
});

test("createHealthResponder() serves the report when an extend rejection cannot become a string", async () => {
  const errors: Error[] = [];
  const responder = createHealthResponder<Ctx>({
    probes: [failingProbe("a", true)],
    extend: () => Promise.reject({ toString: 0, code: "PRIVATE_FAILURE" }),
    onError: (error) => errors.push(error),
  });
  const rendered = await responder.respond({});
  assert.equal(rendered.status, 503);
  assert.equal(rendered.body.status, "unhealthy");
  assert.equal(rendered.body.checks?.[0].status, "failed");
  assert.deepEqual(Object.keys(rendered.body).sort(), [
    "checkedAt",
    "checks",
    "latencyMs",
    "status",
  ]);
  assert.equal(errors.length, 1);
  assert.ok(errors[0] instanceof Error);
  assert.doesNotMatch(errors[0].message, /PRIVATE_FAILURE/);
});

test("createHealthResponder() treats a throwing exposeChecks as false", async () => {
  const seen: Error[] = [];
  const responder = createHealthResponder<Ctx>({
    probes: [okProbe("a")],
    exposeChecks: () => {
      throw new Error("auth down");
    },
    extend: () => ({ region: "fra" }),
    onError: (error) => {
      seen.push(error);
    },
  });
  const rendered = await responder.respond({});
  assert.equal(rendered.body.checks, undefined);
  assert.equal(rendered.body.region, undefined);
  assert.equal(seen[0]?.message, "auth down");
});

test("createHealthResponder() hides details when an exposeChecks rejection cannot become a string", async () => {
  const errors: Error[] = [];
  let extended = false;
  const responder = createHealthResponder<Ctx>({
    probes: [failingProbe("a", true)],
    exposeChecks: () =>
      Promise.reject({ toString: 0, code: "PRIVATE_FAILURE" }),
    extend: () => {
      extended = true;
      return { secret: "private" };
    },
    onError: (error) => errors.push(error),
  });
  const rendered = await responder.respond({});
  assert.equal(rendered.status, 503);
  assert.equal(rendered.body.status, "unhealthy");
  assert.deepEqual(Object.keys(rendered.body).sort(), ["checkedAt", "status"]);
  assert.equal(extended, false);
  assert.equal(errors.length, 1);
  assert.ok(errors[0] instanceof Error);
  assert.doesNotMatch(errors[0].message, /PRIVATE_FAILURE/);
});

test("createHealthResponder() passes the context to onError", async () => {
  let seen: Ctx | undefined;
  const responder = createHealthResponder<Ctx>({
    probes: [okProbe("a")],
    extend: () => {
      throw new Error("boom");
    },
    onError: (_error, ctx) => {
      seen = ctx;
    },
  });
  await responder.respond({ token: "t" });
  assert.deepEqual(seen, { token: "t" });
});

test("createHealthResponder() logs to console.error without onError", async () => {
  const original = console.error;
  const logged: string[] = [];
  console.error = (...args: readonly string[]): void => {
    logged.push(String(args[0]));
  };
  try {
    const responder = createHealthResponder<Ctx>({
      probes: [okProbe("a")],
      extend: () => {
        throw new Error("boom");
      },
    });
    await responder.respond({});
  } finally {
    console.error = original;
  }
  assert.equal(logged[0], "[@openstatus/health]");
});

test("createHealthResponder().toResponse() drops the body on HEAD", async () => {
  const responder = createHealthResponder<Ctx>({
    probes: [failingProbe("a", true)],
  });
  const get = await responder.toResponse({});
  assert.equal(get.status, 503);
  assert.equal((await get.json()).status, "unhealthy");
  const head = await responder.toResponse({}, "HEAD");
  assert.equal(head.status, 503);
  assert.equal(await head.text(), "");
  assert.equal(head.headers.get("cache-control"), "no-store");
});

test("createHealthResponder() survives a non-serializable extend", async () => {
  const circular: { self?: object } = {};
  circular.self = circular;
  const errors: Error[] = [];
  const responder = createHealthResponder<Ctx>({
    probes: [okProbe("a")],
    extend: () => circular,
    onError: (error) => errors.push(error),
  });
  const res = await responder.toResponse({});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.deepEqual(Object.keys(body).sort(), [
    "checkedAt",
    "checks",
    "latencyMs",
    "status",
  ]);
  assert.equal(errors.length, 1);
});
