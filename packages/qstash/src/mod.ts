/**
 * Upstash QStash reachability probe for `@openstatus/health`, against `/v2/queues`.
 *
 * ```ts
 * import { qstashProbe } from "@openstatus/health-qstash";
 *
 * const probe = qstashProbe({ token: env.QSTASH_TOKEN });
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
export const qstashDefaultBaseUrl = "https://qstash.upstash.io";
/** Probe name when `name` is unset. */
export const qstashDefaultName = "qstash";

/** Options for `qstashProbe()`. */
export interface QstashProbeOptions extends ProbeOverrides {
  /** The `QSTASH_TOKEN` from the Upstash console. */
  readonly token: string;
  /** API host. Default `qstashDefaultBaseUrl`. */
  readonly baseUrl?: string | URL;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects 2xx from `GET {baseUrl}/v2/queues` with `token` as a bearer token; non-critical by default. Throws `ProbeConfigError` for an empty `token` or an invalid `baseUrl`. */
export function qstashProbe(options: QstashProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: "qstashProbe",
    field: "baseUrl",
    value: options.baseUrl ?? qstashDefaultBaseUrl,
    path: "/v2/queues",
  });
  if (typeof options.token !== "string" || options.token.length === 0) {
    throw new ProbeConfigError(
      "qstashProbe",
      "token",
      typeof options.token !== "string"
        ? `must be a string, got ${String(options.token)}`
        : "must not be empty",
    );
  }
  const headers = { authorization: `Bearer ${options.token}` };
  return {
    name: options.name ?? qstashDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) => expectOk(doFetch(url, { method: "GET", headers, signal })),
  };
}
