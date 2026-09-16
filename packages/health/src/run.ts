/**
 * One uncached round of probes: timeouts, skipping and status aggregation.
 *
 * @module
 */

import { ProbeTimeoutError, resolveFormatError, toError } from "./errors.ts";
import type {
  CheckResult,
  HealthReport,
  HealthStatus,
  Probe,
  ProbeContext,
  RunProbesOptions,
} from "./types.ts";

/** Per-probe timeout used when neither the probe nor the options set one. */
export const defaultTimeoutMs = 5000;

function normalizeTimeout(value: number | undefined): number | undefined {
  return value != null && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function effectiveTimeoutMs(
  probeMs: number | undefined,
  runMs: number | undefined,
  deadlineMs: number | undefined,
): number {
  const chosen = normalizeTimeout(probeMs) ?? normalizeTimeout(runMs) ??
    defaultTimeoutMs;
  const deadline = normalizeTimeout(deadlineMs);
  return deadline == null ? chosen : Math.min(chosen, deadline);
}

/**
 * Run every probe concurrently once, with no caching, and aggregate the
 * results into a report. Never rejects: a throwing or hanging probe becomes
 * a `failed` or `timeout` check.
 */
export async function runProbes(
  probes: readonly Probe[],
  options: RunProbesOptions = {},
): Promise<HealthReport> {
  const started = performance.now();
  const checks = await Promise.all(
    probes.map((probe) => runProbe(probe, options)),
  );
  return {
    status: aggregate(checks),
    checkedAt: new Date().toISOString(),
    latencyMs: elapsed(started),
    checks,
  };
}

/**
 * `unhealthy` when a critical check failed or timed out, `degraded` when a
 * non-critical one did, `ok` otherwise.
 */
export function aggregate(checks: readonly CheckResult[]): HealthStatus {
  let status: HealthStatus = "ok";
  for (const check of checks) {
    if (check.status !== "failed" && check.status !== "timeout") continue;
    if (check.critical) return "unhealthy";
    status = "degraded";
  }
  return status;
}

async function runProbe(
  probe: Probe,
  options: RunProbesOptions,
): Promise<CheckResult> {
  const ctx: ProbeContext = {
    name: probe.name,
    critical: probe.critical ?? false,
    timeoutMs: effectiveTimeoutMs(
      probe.timeoutMs,
      options.timeoutMs,
      options.deadlineMs,
    ),
  };
  const { name, critical, timeoutMs } = ctx;
  const formatError = resolveFormatError(options.formatError);
  const started = performance.now();

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort(new ProbeTimeoutError(timeoutMs));
      reject(new ProbeTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  const work = Promise.resolve().then(async () => {
    if (await probe.skip?.()) return "skipped";
    controller.signal.throwIfAborted();
    await probe.run(controller.signal, ctx);
    return "ok";
  });
  work.catch(() => {});

  try {
    const status = await Promise.race([work, timeout]);
    if (status === "skipped") return { name, status, critical, latencyMs: 0 };
    return { name, status, critical, latencyMs: elapsed(started) };
  } catch (e) {
    const error = toError(e);
    return {
      name,
      status: error instanceof ProbeTimeoutError ? "timeout" : "failed",
      critical,
      latencyMs: elapsed(started),
      error: formatError(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function elapsed(started: number): number {
  return Math.round(performance.now() - started);
}
