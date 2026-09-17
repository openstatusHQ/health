/**
 * Framework-agnostic core for health endpoints: a probe runner, a cached
 * checker, response rendering and a Fetch-API handler. Zero dependencies.
 *
 * ```ts
 * import { createHealthHandler, httpProbe } from "@openstatus/health";
 *
 * const handler = createHealthHandler({
 *   path: "/health",
 *   probes: [httpProbe({ name: "unkey", url: "https://api.unkey.com/v2/liveness" })],
 * });
 * ```
 *
 * @module
 */

export type {
  CheckResult,
  CheckStatus,
  ExposeChecks,
  Extend,
  FormatError,
  FormatErrorOption,
  HealthCheck,
  HealthCheckOptions,
  HealthCheckSource,
  HealthHandlerOptions,
  HealthHttpResponse,
  HealthProbesSource,
  HealthReport,
  HealthResponder,
  HealthResponderOptions,
  HealthResponseBody,
  HealthResponseOptions,
  HealthRouteOptions,
  HealthSource,
  HealthStatus,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  OnError,
  OnReport,
  Probe,
  ProbeContext,
  ProbeOverrides,
  ProbeResult,
  RunProbesOptions,
} from "./types.ts";
export {
  DuplicateProbeError,
  genericFormatError,
  messageFormatError,
  ProbeConfigError,
  ProbeTimeoutError,
} from "./errors.ts";
export { readEnv, readEnvCount, readEnvText, type ServerEnv } from "./env.ts";
export { omitFields } from "./omit.ts";
export {
  type OmitOptions,
  type ServerEnvOptions,
  serverExtend,
} from "./server.ts";
export { defaultTimeoutMs, runProbes } from "./run.ts";
export { createHealthCheck, defaultCacheMs } from "./check.ts";
export { createHealthResponder, resolveHealthCheck } from "./responder.ts";
export {
  defaultDegradedStatusCode,
  defaultUnhealthyStatusCode,
  renderHealthResponse,
} from "./response.ts";
export {
  createHealthHandler,
  createLazyHealthHandler,
  type HealthHandler,
  type LazyHealthHandler,
} from "./handler.ts";
export {
  expectOk,
  httpProbe,
  type HttpProbeOptions,
  probe,
  probeUrl,
  type ProbeUrlOptions,
} from "./probes.ts";
