/**
 * Turns a `HealthReport` into an HTTP status, headers and body.
 *
 * @module
 */

import type {
  HealthHttpResponse,
  HealthReport,
  HealthResponseOptions,
} from "./types.ts";

/** HTTP status for `unhealthy` when `unhealthyStatusCode` is unset. */
export const defaultUnhealthyStatusCode = 503;
/** HTTP status for `degraded` when `degradedStatusCode` is unset. */
export const defaultDegradedStatusCode = 200;

/** Headers every health response carries. */
export const healthHeaders: Readonly<Record<string, string>> = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

/** The HTTP status code for a report under the given options. */
export function statusCodeFor(
  report: HealthReport,
  options: HealthResponseOptions,
): number {
  switch (report.status) {
    case "unhealthy":
      return options.unhealthyStatusCode ?? defaultUnhealthyStatusCode;
    case "degraded":
      return options.degradedStatusCode ?? defaultDegradedStatusCode;
    default:
      return 200;
  }
}

/**
 * Render `{ status, headers, body }` from a report you already have.
 * `extended` is merged into the body first, so the report's own fields win.
 */
export function renderHealthResponse(
  report: HealthReport,
  options: HealthResponseOptions,
  extended: object = {},
): HealthHttpResponse {
  const exposeChecks = options.exposeChecks ?? true;
  const body = exposeChecks
    ? {
      ...extended,
      status: report.status,
      checkedAt: report.checkedAt,
      latencyMs: report.latencyMs,
      checks: report.checks,
    }
    : { ...extended, status: report.status, checkedAt: report.checkedAt };
  if (!exposeChecks) {
    delete body.checks;
    delete body.latencyMs;
  }
  Reflect.deleteProperty(body, "toJSON");
  return {
    status: statusCodeFor(report, options),
    headers: healthHeaders,
    body,
  };
}
