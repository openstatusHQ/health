/**
 * Trigger.dev reachability probe for `@openstatus/health`, against `/api/v1/runs?page[size]=1`.
 *
 * ```ts
 * import { triggerDevProbe } from "@openstatus/health-trigger-dev";
 *
 * const probe = triggerDevProbe({ secretKey: env.TRIGGER_SECRET_KEY });
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
export const triggerDevDefaultBaseUrl = "https://api.trigger.dev";
/** Probe name when `name` is unset. */
export const triggerDevDefaultName = "trigger";

/** Options for `triggerDevProbe()`. */
export interface TriggerDevProbeOptions extends ProbeOverrides {
  /** The `TRIGGER_SECRET_KEY` of the environment (`tr_dev_…` / `tr_prod_…`). */
  readonly secretKey: string;
  /** API host. Default `triggerDevDefaultBaseUrl`. */
  readonly baseUrl?: string | URL;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects 2xx from `GET {baseUrl}/api/v1/runs?page[size]=1` with `secretKey` as a bearer token; non-critical by default. Throws `ProbeConfigError` for an empty `secretKey` or an invalid `baseUrl`. */
export function triggerDevProbe(options: TriggerDevProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: "triggerDevProbe",
    field: "baseUrl",
    value: options.baseUrl ?? triggerDevDefaultBaseUrl,
    path: "/api/v1/runs?page[size]=1",
  });
  if (typeof options.secretKey !== "string" || options.secretKey.length === 0) {
    throw new ProbeConfigError(
      "triggerDevProbe",
      "secretKey",
      typeof options.secretKey !== "string"
        ? `must be a string, got ${String(options.secretKey)}`
        : "must not be empty",
    );
  }
  const headers = { authorization: `Bearer ${options.secretKey}` };
  return {
    name: options.name ?? triggerDevDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) => expectOk(doFetch(url, { method: "GET", headers, signal })),
  };
}
