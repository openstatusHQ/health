/**
 * Sentry reachability probe for `@openstatus/health`, against `/api/0/`.
 *
 * ```ts
 * import { sentryProbe } from "@openstatus/health-sentry";
 *
 * const probe = sentryProbe({});
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
export const sentryDefaultBaseUrl = "https://sentry.io";
/** Probe name when `name` is unset. */
export const sentryDefaultName = "sentry";

/** Options for `sentryProbe()`. */
export interface SentryProbeOptions extends ProbeOverrides {
  /** An auth token, to also verify credentials. Optional. */
  readonly token?: string;
  /** API host. Default `sentryDefaultBaseUrl`. */
  readonly baseUrl?: string | URL;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects 2xx from `GET {baseUrl}/api/0/`, sending `token` as a bearer token when given; non-critical by default. Throws `ProbeConfigError` for an empty `token` or an invalid `baseUrl`. */
export function sentryProbe(options: SentryProbeOptions = {}): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: "sentryProbe",
    field: "baseUrl",
    value: options.baseUrl ?? sentryDefaultBaseUrl,
    path: "/api/0/",
  });
  if (options.token != null && options.token.length === 0) {
    throw new ProbeConfigError("sentryProbe", "token", "must not be empty");
  }
  const headers = options.token == null
    ? undefined
    : { authorization: `Bearer ${options.token}` };
  return {
    name: options.name ?? sentryDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) => expectOk(doFetch(url, { method: "GET", headers, signal })),
  };
}
