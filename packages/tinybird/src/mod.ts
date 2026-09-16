/**
 * Tinybird reachability probe for `@openstatus/health`, against `/v0/health`.
 *
 * ```ts
 * import { tinybirdProbe } from "@openstatus/health-tinybird";
 *
 * const probe = tinybirdProbe();
 * ```
 *
 * @module
 */

import {
  httpProbe,
  type Probe,
  type ProbeOverrides,
  probeUrl,
} from "@openstatus/health";

/** API base URL when `baseUrl` is unset. */
export const tinybirdDefaultBaseUrl = "https://api.tinybird.co";
/** Probe name when `name` is unset. */
export const tinybirdDefaultName = "tinybird";

/** Options for `tinybirdProbe()`. */
export interface TinybirdProbeOptions extends ProbeOverrides {
  /** Regional API host. Default `tinybirdDefaultBaseUrl`. */
  readonly baseUrl?: string | URL;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects 2xx from `GET {baseUrl}/v0/health`; non-critical by default. */
export function tinybirdProbe(options: TinybirdProbeOptions = {}): Probe {
  return httpProbe({
    name: options.name ?? tinybirdDefaultName,
    url: probeUrl({
      probe: "tinybirdProbe",
      field: "baseUrl",
      value: options.baseUrl ?? tinybirdDefaultBaseUrl,
      path: "/v0/health",
    }),
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    fetch: options.fetch,
  });
}
