/**
 * Upstash Redis probe for `@openstatus/health`, against the REST API's `/ping`.
 *
 * ```ts
 * import { upstashProbe } from "@openstatus/health-upstash";
 *
 * const probe = upstashProbe({ url, token });
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

/** Probe name when `name` is unset. */
export const upstashDefaultName = "redis";

/** Options for `upstashProbe()`. */
export interface UpstashProbeOptions extends ProbeOverrides {
  /** The REST URL, `UPSTASH_REDIS_REST_URL`. */
  readonly url: string | URL;
  /** The REST token, `UPSTASH_REDIS_REST_TOKEN`. */
  readonly token: string;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects 2xx from `GET {url}/ping`; non-critical by default. Throws `ProbeConfigError` for a bad `url` or empty `token`. */
export function upstashProbe(options: UpstashProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: "upstashProbe",
    field: "url",
    value: options.url,
    path: "/ping",
  });
  if (typeof options.token !== "string" || options.token.length === 0) {
    throw new ProbeConfigError(
      "upstashProbe",
      "token",
      typeof options.token !== "string"
        ? `must be a string, got ${String(options.token)}`
        : "must not be empty",
    );
  }
  const headers = { authorization: `Bearer ${options.token}` };
  return {
    name: options.name ?? upstashDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) => expectOk(doFetch(url, { method: "GET", headers, signal })),
  };
}
