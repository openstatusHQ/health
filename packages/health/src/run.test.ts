import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { aggregate, defaultTimeoutMs, runProbes } from "./run.ts";
import type { CheckResult, Probe } from "./types.ts";

const ok = (name: string, critical = false): Probe => ({
  name,
  critical,
  run: () => {},
});

const failing = (name: string, critical = false): Probe => ({
  name,
  critical,
  run: () => {
    throw new Error("boom");
  },
});

const hanging = (name: string, critical = false): Probe => ({
  name,
  critical,
  timeoutMs: 20,
  run: (signal) =>
    new Promise<void>((_, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason));
    }),
});

const check = (
  name: string,
  status: CheckResult["status"],
  critical = false,
): CheckResult => ({ name, status, critical, latencyMs: 0 });

test("aggregate() is ok when every check is ok or skipped", () => {
  assert.equal(aggregate([]), "ok");
  assert.equal(aggregate([check("a", "ok"), check("b", "skipped")]), "ok");
});

test("aggregate() is degraded on a non-critical failure", () => {
  assert.equal(aggregate([check("a", "ok"), check("b", "failed")]), "degraded");
  assert.equal(aggregate([check("b", "timeout")]), "degraded");
});

test("aggregate() is unhealthy on a critical failure", () => {
  assert.equal(
    aggregate([check("a", "failed"), check("b", "failed", true)]),
    "unhealthy",
  );
  assert.equal(aggregate([check("b", "timeout", true)]), "unhealthy");
});

test("runProbes() reports ok checks with latency", async () => {
  const report = await runProbes([ok("a"), ok("b", true)]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks.length, 2);
  assert.deepEqual(
    report.checks.map((c) => [c.name, c.status, c.critical]),
    [["a", "ok", false], ["b", "ok", true]],
  );
  assert.ok(report.checks.every((c) => c.latencyMs >= 0));
  assert.ok(report.latencyMs >= 0);
  assert.ok(!Number.isNaN(Date.parse(report.checkedAt)));
});

test("runProbes() marks skipped probes without running them", async () => {
  let ran = false;
  const report = await runProbes([{
    name: "a",
    skip: () => true,
    run: () => {
      ran = true;
    },
  }]);
  assert.equal(ran, false);
  assert.equal(report.status, "ok");
  assert.deepEqual(report.checks[0], {
    name: "a",
    status: "skipped",
    critical: false,
    latencyMs: 0,
  });
});

test("runProbes() treats a throwing skip() as a failure", async () => {
  const report = await runProbes([{
    name: "a",
    skip: () => {
      throw new Error("nope");
    },
    run: () => {},
  }]);
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("runProbes() uses generic error text by default", async () => {
  const report = await runProbes([failing("a")]);
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "failed");
});

test("runProbes() passes real errors to formatError", async () => {
  const report = await runProbes([failing("a"), {
    name: "b",
    run: () => Promise.reject("raw"),
  }], {
    formatError: (e) => `E: ${e.message}`,
  });
  assert.equal(report.checks[0].error, "E: boom");
  assert.equal(report.checks[1].error, "E: raw");
});

test("runProbes() reports critical rejections that cannot become strings", async () => {
  const report = await runProbes([{
    name: "a",
    critical: true,
    run: () => Promise.reject({ toString: 0, code: "PRIVATE_FAILURE" }),
  }], { formatError: "message" });
  assert.equal(report.status, "unhealthy");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].critical, true);
  assert.equal(typeof report.checks[0].error, "string");
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_FAILURE/);
});

test("runProbes() times out and aborts the signal", async () => {
  const report = await runProbes([hanging("a", true)]);
  assert.equal(report.status, "unhealthy");
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(report.checks[0].error, "timed out after 20ms");
});

test("runProbes() falls back to the option-level timeout", async () => {
  const report = await runProbes([{
    name: "a",
    run: (signal) =>
      new Promise<void>((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason));
      }),
  }], { timeoutMs: 10 });
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(report.checks[0].error, "timed out after 10ms");
});

test("runProbes() runs probes concurrently", async () => {
  const slow = (name: string): Probe => ({
    name,
    run: () => delay(30),
  });
  const started = performance.now();
  await runProbes([slow("a"), slow("b"), slow("c")]);
  assert.ok(performance.now() - started < 80);
});

test("runProbes() accepts probes resolving to values", async () => {
  const report = await runProbes([
    { name: "a", run: () => Promise.resolve({ rows: [1] }) },
    { name: "b", run: () => "PONG" },
    { name: "c", run: () => 42 },
  ]);
  assert.equal(report.status, "ok");
});

test("runProbes() awaits an async skip()", async () => {
  let ran = false;
  const report = await runProbes([{
    name: "a",
    skip: () => Promise.resolve(true),
    run: () => {
      ran = true;
    },
  }]);
  assert.equal(ran, false);
  assert.equal(report.checks[0].status, "skipped");
});

test("runProbes() times out a hanging skip()", async () => {
  const report = await runProbes([{
    name: "a",
    timeoutMs: 10,
    skip: () => new Promise<boolean>(() => {}),
    run: () => {},
  }]);
  assert.equal(report.checks[0].status, "timeout");
});

test("runProbes() does not start work when skip() resolves false after timeout", async () => {
  const skip = Promise.withResolvers<boolean>();
  let ran = false;
  const report = await runProbes([{
    name: "a",
    timeoutMs: 10,
    skip: () => skip.promise,
    run: () => {
      ran = true;
    },
  }]);
  assert.equal(report.checks[0].status, "timeout");
  const completed = structuredClone(report);

  skip.resolve(false);
  await delay(0);

  assert.equal(ran, false);
  assert.deepEqual(report, completed);
});

test("runProbes() passes name, critical and timeoutMs to run()", async () => {
  let seen: { name: string; critical: boolean; timeoutMs: number } | undefined;
  await runProbes([{
    name: "a",
    critical: true,
    run: (_signal, ctx) => {
      seen = { ...ctx };
    },
  }], { timeoutMs: 123 });
  assert.deepEqual(seen, { name: "a", critical: true, timeoutMs: 123 });
});

test("runProbes() keeps a late rejection handled", async () => {
  let unhandled = 0;
  const onUnhandled = (): void => {
    unhandled++;
  };
  process.on("unhandledRejection", onUnhandled);
  try {
    const report = await runProbes([{
      name: "a",
      timeoutMs: 10,
      run: () =>
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error("late")), 30);
        }),
    }]);
    assert.equal(report.checks[0].status, "timeout");
    await delay(50);
    assert.equal(unhandled, 0);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});

test("runProbes() caps every probe's timeout at deadlineMs", async () => {
  const seen: number[] = [];
  const report = await runProbes(
    [
      {
        name: "slow",
        timeoutMs: 5000,
        run: (signal, ctx) => {
          seen.push(ctx.timeoutMs);
          return new Promise<void>((_, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason));
          });
        },
      },
      {
        name: "quick",
        timeoutMs: 5,
        run: (_signal, ctx) => {
          seen.push(ctx.timeoutMs);
        },
      },
    ],
    { deadlineMs: 20 },
  );
  assert.deepEqual(seen, [20, 5]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(report.checks[0].error, "timed out after 20ms");
  assert.equal(report.checks[1].status, "ok");
  assert.ok(report.latencyMs < 1000);
});

test("runProbes() ignores non-positive and non-finite timeouts", async () => {
  const seen: number[] = [];
  await runProbes([
    {
      name: "zero",
      timeoutMs: 0,
      run: (_signal, ctx) => void seen.push(ctx.timeoutMs),
    },
    {
      name: "negative",
      timeoutMs: -1,
      run: (_signal, ctx) => void seen.push(ctx.timeoutMs),
    },
    {
      name: "infinite",
      timeoutMs: Infinity,
      run: (_signal, ctx) => void seen.push(ctx.timeoutMs),
    },
    {
      name: "nan",
      timeoutMs: Number.NaN,
      run: (_signal, ctx) => void seen.push(ctx.timeoutMs),
    },
  ], { timeoutMs: 0, deadlineMs: 0 });
  assert.deepEqual(seen, [
    defaultTimeoutMs,
    defaultTimeoutMs,
    defaultTimeoutMs,
    defaultTimeoutMs,
  ]);
});
