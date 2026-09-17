/**
 * WorkOS reachability probe for `@openstatus/health`, against `/organizations?limit=1`.
 *
 * ```ts
 * import { workosProbe } from "@openstatus/health-workos";
 *
 * const probe = workosProbe({ apiKey: env.WORKOS_API_KEY });
 * ```
 *
 * @module
 */

import {
  expectOk,
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
  probeUrl,
} from "@openstatus/health";

/** API base URL when `baseUrl` is unset. */
export const workosDefaultBaseUrl = "https://api.workos.com";
/** Probe name when `name` is unset. */
export const workosDefaultName = "workos";

/** Options for `workosProbe()`. */
export interface WorkosProbeOptions extends ProbeOverrides {
  /** The `WORKOS_API_KEY` of the environment (`sk_…`). */
  readonly apiKey: string;
  /** API host. Default `workosDefaultBaseUrl`. */
  readonly baseUrl?: string | URL;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects 2xx from `GET {baseUrl}/organizations?limit=1` with `apiKey` as a bearer token; non-critical by default. Throws `ProbeConfigError` for an empty `apiKey` or an invalid `baseUrl`. */
export function workosProbe(options: WorkosProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: "workosProbe",
    field: "baseUrl",
    value: options.baseUrl ?? workosDefaultBaseUrl,
    path: "/organizations?limit=1",
  });
  if (typeof options.apiKey !== "string" || options.apiKey.length === 0) {
    throw new ProbeConfigError(
      "workosProbe",
      "apiKey",
      typeof options.apiKey !== "string"
        ? `must be a string, got ${String(options.apiKey)}`
        : "must not be empty",
    );
  }
  const headers = { authorization: `Bearer ${options.apiKey}` };
  return {
    name: options.name ?? workosDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) => expectOk(doFetch(url, { method: "GET", headers, signal })),
  };
}
