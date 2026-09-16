/**
 * Meilisearch probe for `@openstatus/health`, against `/health`, which must
 * report `status: "available"`.
 *
 * ```ts
 * import { meilisearchProbe } from "@openstatus/health-meilisearch";
 *
 * const probe = meilisearchProbe({ host: env.MEILISEARCH_HOST });
 * ```
 *
 * @module
 */

import {
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
  probeUrl,
} from "@openstatus/health";

/** Probe name when `name` is unset. */
export const meilisearchDefaultName = "search";

/** Options for `meilisearchProbe()`. */
export interface MeilisearchProbeOptions extends ProbeOverrides {
  /** The instance URL, e.g. `https://ms-xxx.meilisearch.io` or `http://localhost:7700`. */
  readonly host: string | URL;
  /** An API key, sent as a bearer token. `/health` does not need one. */
  readonly apiKey?: string;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects `GET {host}/health` to answer 2xx with `status: "available"`; non-critical by default. Throws `ProbeConfigError` for an invalid `host` or an empty `apiKey`. */
export function meilisearchProbe(options: MeilisearchProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: "meilisearchProbe",
    field: "host",
    value: options.host,
    path: "/health",
  });
  if (options.apiKey != null && options.apiKey.length === 0) {
    throw new ProbeConfigError(
      "meilisearchProbe",
      "apiKey",
      "must not be empty",
    );
  }
  const headers = options.apiKey == null
    ? undefined
    : { authorization: `Bearer ${options.apiKey}` };
  return {
    name: options.name ?? meilisearchDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async (signal) => {
      const res = await doFetch(url, { method: "GET", headers, signal });
      if (!res.ok) {
        await res.body?.cancel();
        throw new Error(`unexpected status ${res.status}`);
      }
      const body: { readonly status?: string } | null = await res.json()
        .catch(() => null);
      const status = body?.status;
      if (status !== "available") {
        throw new Error(`unexpected health status ${JSON.stringify(status)}`);
      }
    },
  };
}
