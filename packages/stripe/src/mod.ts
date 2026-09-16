/**
 * Stripe reachability probe for `@openstatus/health`, against `/v1/balance`.
 *
 * ```ts
 * import { stripeProbe } from "@openstatus/health-stripe";
 *
 * const probe = stripeProbe({ secretKey: env.STRIPE_SECRET_KEY });
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
export const stripeDefaultBaseUrl = "https://api.stripe.com";
/** Probe name when `name` is unset. */
export const stripeDefaultName = "stripe";

/** Options for `stripeProbe()`. */
export interface StripeProbeOptions extends ProbeOverrides {
  /** A secret or restricted API key with `balance` read access. */
  readonly secretKey: string;
  /** API host. Default `stripeDefaultBaseUrl`. */
  readonly baseUrl?: string | URL;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects 2xx from `GET {baseUrl}/v1/balance` with `secretKey` as a bearer token; non-critical by default. Throws `ProbeConfigError` for an empty `secretKey` or an invalid `baseUrl`. */
export function stripeProbe(options: StripeProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: "stripeProbe",
    field: "baseUrl",
    value: options.baseUrl ?? stripeDefaultBaseUrl,
    path: "/v1/balance",
  });
  if (typeof options.secretKey !== "string" || options.secretKey.length === 0) {
    throw new ProbeConfigError(
      "stripeProbe",
      "secretKey",
      typeof options.secretKey !== "string"
        ? `must be a string, got ${String(options.secretKey)}`
        : "must not be empty",
    );
  }
  const headers = { authorization: `Bearer ${options.secretKey}` };
  return {
    name: options.name ?? stripeDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) => expectOk(doFetch(url, { method: "GET", headers, signal })),
  };
}
