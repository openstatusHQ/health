/**
 * Clerk reachability probe for `@openstatus/health`, against `/v1/users?limit=1`.
 *
 * ```ts
 * import { clerkProbe } from "@openstatus/health-clerk";
 *
 * const probe = clerkProbe({ secretKey: env.CLERK_SECRET_KEY });
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
export const clerkDefaultBaseUrl = "https://api.clerk.com";
/** Probe name when `name` is unset. */
export const clerkDefaultName = "clerk";

/** Options for `clerkProbe()`. */
export interface ClerkProbeOptions extends ProbeOverrides {
  /** The `CLERK_SECRET_KEY` of the instance (`sk_live_…` / `sk_test_…`). */
  readonly secretKey: string;
  /** API host. Default `clerkDefaultBaseUrl`. */
  readonly baseUrl?: string | URL;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects 2xx from `GET {baseUrl}/v1/users?limit=1` with `secretKey` as a bearer token; non-critical by default. Throws `ProbeConfigError` for an empty `secretKey` or an invalid `baseUrl`. */
export function clerkProbe(options: ClerkProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: "clerkProbe",
    field: "baseUrl",
    value: options.baseUrl ?? clerkDefaultBaseUrl,
    path: "/v1/users?limit=1",
  });
  if (typeof options.secretKey !== "string" || options.secretKey.length === 0) {
    throw new ProbeConfigError(
      "clerkProbe",
      "secretKey",
      typeof options.secretKey !== "string"
        ? `must be a string, got ${String(options.secretKey)}`
        : "must not be empty",
    );
  }
  const headers = { authorization: `Bearer ${options.secretKey}` };
  return {
    name: options.name ?? clerkDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) => expectOk(doFetch(url, { method: "GET", headers, signal })),
  };
}
