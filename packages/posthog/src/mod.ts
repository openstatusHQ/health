/**
 * PostHog reachability probe for `@openstatus/health`, against `/api/projects/@current/`.
 *
 * ```ts
 * import { posthogProbe } from "@openstatus/health-posthog";
 *
 * const probe = posthogProbe({ personalApiKey: env.POSTHOG_PERSONAL_API_KEY });
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
export const posthogDefaultBaseUrl = "https://us.posthog.com";
/** Probe name when `name` is unset. */
export const posthogDefaultName = "posthog";

/** Options for `posthogProbe()`. */
export interface PosthogProbeOptions extends ProbeOverrides {
  /** A personal API key (`phx_…`) with `project:read` scope. */
  readonly personalApiKey: string;
  /** API host. Default `posthogDefaultBaseUrl`. */
  readonly baseUrl?: string | URL;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects 2xx from `GET {baseUrl}/api/projects/@current/` with `personalApiKey` as a bearer token; non-critical by default. Throws `ProbeConfigError` for an empty `personalApiKey` or an invalid `baseUrl`. */
export function posthogProbe(options: PosthogProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: "posthogProbe",
    field: "baseUrl",
    value: options.baseUrl ?? posthogDefaultBaseUrl,
    path: "/api/projects/@current/",
  });
  if (
    typeof options.personalApiKey !== "string" ||
    options.personalApiKey.length === 0
  ) {
    throw new ProbeConfigError(
      "posthogProbe",
      "personalApiKey",
      typeof options.personalApiKey !== "string"
        ? `must be a string, got ${String(options.personalApiKey)}`
        : "must not be empty",
    );
  }
  const headers = { authorization: `Bearer ${options.personalApiKey}` };
  return {
    name: options.name ?? posthogDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) => expectOk(doFetch(url, { method: "GET", headers, signal })),
  };
}
