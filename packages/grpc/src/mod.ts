/**
 * gRPC probe for `@openstatus/health`: calls `grpc.health.v1.Health/Check`
 * through a generated `@grpc/grpc-js` health client and expects `SERVING`.
 *
 * ```ts
 * import { HealthClient } from "grpc-health-check";
 * import { grpcProbe } from "@openstatus/health-grpc";
 *
 * const probe = grpcProbe({ client: new HealthClient(address, credentials) });
 * ```
 *
 * @module
 */

import {
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
} from "@openstatus/health";

/** Probe name when `name` is unset. */
export const grpcDefaultName = "grpc";
/** Service checked when `service` is unset: the empty string means the server as a whole. */
export const grpcDefaultService = "";

/** What `Check` answers; `status` is `1` or `"SERVING"` when healthy, depending on how enums were loaded. */
export interface GrpcHealthCheckResponse {
  /** The `ServingStatus` enum value. */
  readonly status?: number | string;
}

/** The subset of a `ClientUnaryCall` the probe uses. */
export interface GrpcLikeCall {
  /** Cancel the in-flight call. */
  cancel(): void;
}

/** The subset of a generated `Health` client the probe uses. */
export interface GrpcLikeHealthClient {
  /** Call `Health/Check` for `service`. */
  check(
    request: { readonly service: string },
    callback: (
      error: Error | null,
      response?: GrpcHealthCheckResponse,
    ) => void,
  ): GrpcLikeCall;
}

/** Options for `grpcProbe()`. */
export interface GrpcProbeOptions extends ProbeOverrides {
  /** A `grpc.health.v1.Health` client, e.g. from `grpc-health-check` or your generated stubs. */
  readonly client: GrpcLikeHealthClient;
  /** The service name to check. Default `grpcDefaultService`. */
  readonly service?: string;
}

/** A probe that calls `Health/Check` and expects `SERVING`; non-critical by default. Throws `ProbeConfigError` without `check()` or for a non-string `service`. */
export function grpcProbe(options: GrpcProbeOptions): Probe {
  const client = options.client;
  if (typeof client?.check !== "function") {
    throw new ProbeConfigError(
      "grpcProbe",
      "client",
      `must expose check(), got ${describe(client)}`,
    );
  }
  const service = options.service ?? grpcDefaultService;
  if (typeof service !== "string") {
    throw new ProbeConfigError(
      "grpcProbe",
      "service",
      `must be a string, got ${String(service)}`,
    );
  }
  return {
    name: options.name ?? grpcDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) =>
      new Promise<void>((resolve, reject) => {
        const call = client.check({ service }, (error, response) => {
          signal.removeEventListener("abort", onAbort);
          if (error != null) {
            reject(error);
            return;
          }
          const status = response?.status;
          if (status === 1 || status === "SERVING") {
            resolve();
            return;
          }
          reject(new Error(`serving status ${describeStatus(status)}`));
        });
        const onAbort = () => {
          call.cancel();
          reject(signal.reason);
        };
        signal.addEventListener("abort", onAbort, { once: true });
      }),
  };
}

function describeStatus(status: number | string | undefined): string {
  if (status === 0 || status === "UNKNOWN") return "UNKNOWN";
  if (status === 2 || status === "NOT_SERVING") return "NOT_SERVING";
  if (status === 3 || status === "SERVICE_UNKNOWN") return "SERVICE_UNKNOWN";
  return String(status);
}

function describe(client: GrpcLikeHealthClient): string {
  if (client == null) return String(client);
  if (typeof client !== "object") return typeof client;
  const keys = Object.keys(client);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
