import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { runInNewContext } from "node:vm";
import { createHealthCheck } from "./check.ts";
import { DuplicateProbeError } from "./errors.ts";
import type { Probe } from "./types.ts";

function counting(
  name: string,
  fail = false,
): { probe: Probe; calls: () => number } {
  let calls = 0;
  return {
    probe: {
      name,
      run: async () => {
        calls++;
        await delay(5);
        if (fail) throw new Error("boom");
      },
    },
    calls: () => calls,
  };
}

test("createHealthCheck() rejects duplicate probe names", () => {
  assert.throws(
    () =>
      createHealthCheck({
        probes: [{ name: "a", run: () => {} }, { name: "a", run: () => {} }],
      }),
    DuplicateProbeError,
  );
});

test("createHealthCheck() caches reports within cacheMs", async () => {
  const { probe, calls } = counting("a");
  const check = createHealthCheck({ probes: [probe], cacheMs: 1000 });
  const first = await check.report();
  const second = await check.report();
  assert.equal(calls(), 1);
  assert.equal(first, second);
});

test("createHealthCheck() re-runs after cacheMs elapsed", async () => {
  const { probe, calls } = counting("a");
  const check = createHealthCheck({ probes: [probe], cacheMs: 20 });
  await check.report();
  await delay(30);
  await check.report();
  assert.equal(calls(), 2);
});

test("createHealthCheck() shares one in-flight round", async () => {
  const { probe, calls } = counting("a");
  const check = createHealthCheck({ probes: [probe], cacheMs: 0 });
  const [a, b, c] = await Promise.all([
    check.report(),
    check.report(),
    check.report(),
  ]);
  assert.equal(calls(), 1);
  assert.equal(a, b);
  assert.equal(b, c);
});

test("createHealthCheck() with cacheMs 0 runs on every request", async () => {
  const { probe, calls } = counting("a");
  const check = createHealthCheck({ probes: [probe], cacheMs: 0 });
  await check.report();
  await check.report();
  assert.equal(calls(), 2);
});

test("createHealthCheck() caches failed reports for the same TTL", async () => {
  const { probe, calls } = counting("a", true);
  const check = createHealthCheck({ probes: [probe], cacheMs: 1000 });
  const report = await check.report();
  assert.equal(report.status, "degraded");
  await check.report();
  assert.equal(calls(), 1);
});

test("createHealthCheck().invalidate() drops the cache", async () => {
  const { probe, calls } = counting("a");
  const check = createHealthCheck({ probes: [probe], cacheMs: 1000 });
  await check.report();
  check.invalidate();
  await check.report();
  assert.equal(calls(), 2);
});

test("createHealthCheck() forwards timeoutMs and formatError", async () => {
  const check = createHealthCheck({
    probes: [{
      name: "a",
      run: (signal) =>
        new Promise<void>((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        }),
    }],
    timeoutMs: 10,
    formatError: (e) => e.name,
  });
  const report = await check.report();
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(report.checks[0].error, "ProbeTimeoutError");
});

test("createHealthCheck() honours cacheFailuresMs for non-ok reports", async () => {
  const { probe, calls } = counting("a", true);
  const check = createHealthCheck({
    probes: [probe],
    cacheMs: 1000,
    cacheFailuresMs: 0,
  });
  assert.equal((await check.report()).status, "degraded");
  await check.report();
  assert.equal(calls(), 2);
});

test("createHealthCheck() calls onReport once per uncached round", async () => {
  const { probe } = counting("a");
  const seen: string[] = [];
  const check = createHealthCheck({
    probes: [probe],
    cacheMs: 1000,
    onReport: (report) => {
      seen.push(report.status);
    },
  });
  await check.report();
  await check.report();
  assert.deepEqual(seen, ["ok"]);
});

test("createHealthCheck() swallows onReport errors", async () => {
  const { probe } = counting("a");
  const check = createHealthCheck({
    probes: [probe],
    onReport: () => {
      throw new Error("logger down");
    },
  });
  assert.equal((await check.report()).status, "ok");
  const rejecting = createHealthCheck({
    probes: [probe],
    onReport: () => Promise.reject(new Error("logger down")),
  });
  assert.equal((await rejecting.report()).status, "ok");
});

test("createHealthCheck() swallows onReport rejections from another realm", async () => {
  const { probe } = counting("a");
  const ForeignPromise: PromiseConstructor = runInNewContext("Promise");
  assert.notEqual(ForeignPromise, Promise);
  const check = createHealthCheck({
    probes: [probe],
    onReport: () => ForeignPromise.reject(new Error("logger down")),
  });
  const report = await check.report();
  assert.equal(report.status, "ok");
  await delay(0);
  assert.equal(await check.report(), report);
});

test("createHealthCheck() accepts the formatError presets", async () => {
  const { probe } = counting("a", true);
  const generic = await createHealthCheck({ probes: [probe] }).report();
  assert.equal(generic.checks[0].error, "failed");
  const message = await createHealthCheck({
    probes: [probe],
    formatError: "message",
  }).report();
  assert.equal(message.checks[0].error, "boom");
});

test("createHealthCheck() serves a stale report while refreshing within staleMs", async () => {
  const { probe, calls } = counting("a");
  const check = createHealthCheck({
    probes: [probe],
    cacheMs: 20,
    staleMs: 1000,
  });
  const first = await check.report();
  await delay(30);
  const started = performance.now();
  const stale = await check.report();
  assert.ok(performance.now() - started < 5);
  assert.equal(stale, first);
  await delay(15);
  assert.equal(calls(), 2);
  const fresh = await check.report();
  assert.notEqual(fresh, first);
});

test("createHealthCheck() blocks once the stale window has passed", async () => {
  const { probe, calls } = counting("a");
  const check = createHealthCheck({
    probes: [probe],
    cacheMs: 10,
    staleMs: 10,
  });
  const first = await check.report();
  await delay(30);
  const second = await check.report();
  assert.notEqual(second, first);
  assert.equal(calls(), 2);
});

test("createHealthCheck() forwards deadlineMs", async () => {
  const check = createHealthCheck({
    probes: [{
      name: "a",
      timeoutMs: 5000,
      run: (signal) =>
        new Promise<void>((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        }),
    }],
    deadlineMs: 10,
  });
  const report = await check.report();
  assert.equal(report.checks[0].status, "timeout");
  assert.ok(report.latencyMs < 1000);
});

test("createHealthCheck() accepts a prebuilt check through resolveHealthCheck", async () => {
  const { resolveHealthCheck } = await import("./responder.ts");
  const { probe, calls } = counting("a");
  const check = createHealthCheck({ probes: [probe], cacheMs: 1000 });
  assert.equal(resolveHealthCheck({ check }), check);
  const built = resolveHealthCheck({ probes: [probe] });
  assert.notEqual(built, check);
  await built.report();
  assert.equal(calls(), 1);
});

test("createHealthCheck().invalidate() abandons an in-flight round", async () => {
  const gate = Promise.withResolvers<void>();
  let calls = 0;
  const check = createHealthCheck({
    probes: [{
      name: "a",
      run: async () => {
        calls++;
        if (calls === 1) await gate.promise;
      },
    }],
    cacheMs: 1000,
  });
  const first = check.report();
  check.invalidate();
  const second = check.report();
  gate.resolve();
  const [firstReport, secondReport] = await Promise.all([first, second]);
  await delay(0);
  assert.equal(calls, 2);
  assert.notEqual(firstReport, secondReport);
  assert.equal(await check.report(), secondReport);
  assert.equal(calls, 2);
});
