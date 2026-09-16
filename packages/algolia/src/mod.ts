/**
 * Algolia reachability probe for `@openstatus/health`, against `/1/isalive`
 * on the application's DSN host.
 *
 * ```ts
 * import { algoliaProbe } from "@openstatus/health-algolia";
 *
 * const probe = algoliaProbe({ appId: env.ALGOLIA_APP_ID, apiKey: env.ALGOLIA_SEARCH_KEY });
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
export const algoliaDefaultName = "search";

/** The DSN host for an application, used when `baseUrl` is unset. */
export function algoliaDsnUrl(appId: string): string {
  return `https://${appId.toLowerCase()}-dsn.algolia.net`;
}

/** Options for `algoliaProbe()`. */
export interface AlgoliaProbeOptions extends ProbeOverrides {
  /** The application ID. */
  readonly appId: string;
  /** Any API key of the application; a search-only key is enough. */
  readonly apiKey: string;
  /** API host. Default `algoliaDsnUrl(appId)`. */
  readonly baseUrl?: string | URL;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects 2xx from `GET {baseUrl}/1/isalive` with the application headers; non-critical by default. Throws `ProbeConfigError` for an empty `appId` or `apiKey`, or an invalid `baseUrl`. */
export function algoliaProbe(options: AlgoliaProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  for (const field of ["appId", "apiKey"] as const) {
    const value = options[field];
    if (typeof value !== "string" || value.length === 0) {
      throw new ProbeConfigError(
        "algoliaProbe",
        field,
        typeof value !== "string"
          ? `must be a string, got ${String(value)}`
          : "must not be empty",
      );
    }
  }
  const url = probeUrl({
    probe: "algoliaProbe",
    field: "baseUrl",
    value: options.baseUrl ?? algoliaDsnUrl(options.appId),
    path: "/1/isalive",
  });
  const headers = {
    "x-algolia-application-id": options.appId,
    "x-algolia-api-key": options.apiKey,
  };
  return {
    name: options.name ?? algoliaDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) => expectOk(doFetch(url, { method: "GET", headers, signal })),
  };
}
