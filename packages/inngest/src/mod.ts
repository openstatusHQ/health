/**
 * Inngest reachability probe for `@openstatus/health`, against `/v1/events?limit=1`.
 *
 * ```ts
 * import { inngestProbe } from "@openstatus/health-inngest";
 *
 * const probe = inngestProbe({ signingKey: env.INNGEST_SIGNING_KEY });
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
export const inngestDefaultBaseUrl = "https://api.inngest.com";
/** Probe name when `name` is unset. */
export const inngestDefaultName = "inngest";

/** Options for `inngestProbe()`. */
export interface InngestProbeOptions extends ProbeOverrides {
  /** The `INNGEST_SIGNING_KEY` of the environment; the REST API authenticates with it. */
  readonly signingKey: string;
  /** API host. Default `inngestDefaultBaseUrl`. */
  readonly baseUrl?: string | URL;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects 2xx from `GET {baseUrl}/v1/events?limit=1` with `signingKey` as a bearer token; non-critical by default. Throws `ProbeConfigError` for an empty `signingKey` or an invalid `baseUrl`. */
export function inngestProbe(options: InngestProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: "inngestProbe",
    field: "baseUrl",
    value: options.baseUrl ?? inngestDefaultBaseUrl,
    path: "/v1/events?limit=1",
  });
  if (
    typeof options.signingKey !== "string" || options.signingKey.length === 0
  ) {
    throw new ProbeConfigError(
      "inngestProbe",
      "signingKey",
      typeof options.signingKey !== "string"
        ? `must be a string, got ${String(options.signingKey)}`
        : "must not be empty",
    );
  }
  const headers = { authorization: `Bearer ${options.signingKey}` };
  return {
    name: options.name ?? inngestDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) => expectOk(doFetch(url, { method: "GET", headers, signal })),
  };
}
