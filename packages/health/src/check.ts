/**
 * A cached health check with in-flight de-duplication and
 * stale-while-revalidate.
 *
 * @module
 */

import { runProbes } from "./run.ts";
import type {
  HealthCheck,
  HealthCheckOptions,
  HealthReport,
  OnReport,
} from "./types.ts";
import { assertUniqueProbeNames } from "./validate.ts";

/** How long an `ok` report is reused when `cacheMs` is unset. */
export const defaultCacheMs = 5000;

/**
 * Build a `HealthCheck` that runs `options.probes` at most once per cache
 * window, shares one round between concurrent callers, and can serve a stale
 * report while refreshing. Throws `DuplicateProbeError` for repeated names.
 */
export function createHealthCheck(options: HealthCheckOptions): HealthCheck {
  assertUniqueProbeNames(options.probes);
  const cacheMs = options.cacheMs ?? defaultCacheMs;
  const cacheFailuresMs = options.cacheFailuresMs ?? cacheMs;
  const staleMs = options.staleMs ?? 0;
  let cached:
    | { readonly at: number; readonly report: HealthReport }
    | undefined;
  let pending: Promise<HealthReport> | undefined;
  let generation = 0;

  const refresh = (): Promise<HealthReport> => {
    if (pending != null) return pending;
    const gen = generation;
    pending = runProbes(options.probes, {
      timeoutMs: options.timeoutMs,
      deadlineMs: options.deadlineMs,
      formatError: options.formatError,
    })
      .then((report) => {
        if (gen === generation) cached = { at: Date.now(), report };
        notify(options.onReport, report);
        return report;
      })
      .finally(() => {
        if (gen === generation) pending = undefined;
      });
    return pending;
  };

  return {
    report(): Promise<HealthReport> {
      if (cached != null) {
        const age = Date.now() - cached.at;
        const ttl = cached.report.status === "ok" ? cacheMs : cacheFailuresMs;
        if (age < ttl) return Promise.resolve(cached.report);
        if (age < ttl + staleMs) {
          refresh().catch(() => {});
          return Promise.resolve(cached.report);
        }
      }
      return refresh();
    },
    invalidate(): void {
      generation++;
      cached = undefined;
      pending = undefined;
    },
  };
}

function notify(onReport: OnReport | undefined, report: HealthReport): void {
  if (onReport == null) return;
  try {
    Promise.resolve(onReport(report)).catch(() => {});
  } catch {
    return;
  }
}
