import type {
  HealthHttpResponse,
  HealthReport,
  HealthResponseOptions,
} from "./types.ts";

export const defaultUnhealthyStatusCode = 503;
export const defaultDegradedStatusCode = 200;

export const healthHeaders: Readonly<Record<string, string>> = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

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
