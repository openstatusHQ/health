/**
 * Typesense probe for `@openstatus/health`, against `/health`, which must
 * report `ok: true`.
 *
 * ```ts
 * import { typesenseProbe } from "@openstatus/health-typesense";
 *
 * const probe = typesenseProbe({ host: env.TYPESENSE_HOST });
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
export const typesenseDefaultName = "search";

/** Options for `typesenseProbe()`. */
export interface TypesenseProbeOptions extends ProbeOverrides {
  /** The node URL, e.g. `https://xxx.a1.typesense.net` or `http://localhost:8108`. */
  readonly host: string | URL;
  /** An API key, sent as `x-typesense-api-key`. `/health` does not need one. */
  readonly apiKey?: string;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects `GET {host}/health` to answer 2xx with `ok: true`; non-critical by default. Throws `ProbeConfigError` for an invalid `host` or an empty `apiKey`. */
export function typesenseProbe(options: TypesenseProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: "typesenseProbe",
    field: "host",
    value: options.host,
    path: "/health",
  });
  if (options.apiKey != null && options.apiKey.length === 0) {
    throw new ProbeConfigError("typesenseProbe", "apiKey", "must not be empty");
  }
  const headers = options.apiKey == null
    ? undefined
    : { "x-typesense-api-key": options.apiKey };
  return {
    name: options.name ?? typesenseDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async (signal) => {
      const res = await doFetch(url, { method: "GET", headers, signal });
      if (!res.ok) {
        await res.body?.cancel();
        throw new Error(`unexpected status ${res.status}`);
      }
      const body: { readonly ok?: boolean } | null = await res.json()
        .catch(() => null);
      if (body?.ok !== true) {
        throw new Error(`unexpected health body ${JSON.stringify(body)}`);
      }
    },
  };
}
