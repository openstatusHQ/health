/**
 * Resend reachability probe for `@openstatus/health`, against `/domains`.
 *
 * ```ts
 * import { resendProbe } from "@openstatus/health-resend";
 *
 * const probe = resendProbe({ apiKey: env.RESEND_API_KEY });
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
export const resendDefaultBaseUrl = "https://api.resend.com";
/** Probe name when `name` is unset. */
export const resendDefaultName = "resend";

/** Options for `resendProbe()`. */
export interface ResendProbeOptions extends ProbeOverrides {
  /** A Resend API key; full-access or a sending key with domain read access. */
  readonly apiKey: string;
  /** API host. Default `resendDefaultBaseUrl`. */
  readonly baseUrl?: string | URL;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects 2xx from `GET {baseUrl}/domains` with `apiKey` as a bearer token; non-critical by default. Throws `ProbeConfigError` for an empty `apiKey` or an invalid `baseUrl`. */
export function resendProbe(options: ResendProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: "resendProbe",
    field: "baseUrl",
    value: options.baseUrl ?? resendDefaultBaseUrl,
    path: "/domains",
  });
  if (typeof options.apiKey !== "string" || options.apiKey.length === 0) {
    throw new ProbeConfigError(
      "resendProbe",
      "apiKey",
      typeof options.apiKey !== "string"
        ? `must be a string, got ${String(options.apiKey)}`
        : "must not be empty",
    );
  }
  const headers = { authorization: `Bearer ${options.apiKey}` };
  return {
    name: options.name ?? resendDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) => expectOk(doFetch(url, { method: "GET", headers, signal })),
  };
}
