/**
 * Unkey reachability probe for `@openstatus/health`, against `/v2/liveness`.
 *
 * ```ts
 * import { unkeyProbe } from "@openstatus/health-unkey";
 *
 * const probe = unkeyProbe();
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
export const unkeyDefaultBaseUrl = "https://api.unkey.com";
/** Probe name when `name` is unset. */
export const unkeyDefaultName = "unkey";

/** Options for `unkeyProbe()`. */
export interface UnkeyProbeOptions extends ProbeOverrides {
  /** API host. Default `unkeyDefaultBaseUrl`. */
  readonly baseUrl?: string | URL;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects 2xx from `GET {baseUrl}/v2/liveness`; non-critical by default. */
export function unkeyProbe(options: UnkeyProbeOptions = {}): Probe {
  return httpProbe({
    name: options.name ?? unkeyDefaultName,
    url: probeUrl({
      probe: "unkeyProbe",
      field: "baseUrl",
      value: options.baseUrl ?? unkeyDefaultBaseUrl,
      path: "/v2/liveness",
    }),
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    fetch: options.fetch,
  });
}
