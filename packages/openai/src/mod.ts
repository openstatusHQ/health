/**
 * OpenAI reachability probe for `@openstatus/health`, against `/v1/models`.
 *
 * ```ts
 * import { openaiProbe } from "@openstatus/health-openai";
 *
 * const probe = openaiProbe({ apiKey: env.OPENAI_API_KEY });
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
export const openaiDefaultBaseUrl = "https://api.openai.com";
/** Probe name when `name` is unset. */
export const openaiDefaultName = "openai";

/** Options for `openaiProbe()`. */
export interface OpenaiProbeOptions extends ProbeOverrides {
  /** An OpenAI API key (`sk-…`). */
  readonly apiKey: string;
  /** API host. Default `openaiDefaultBaseUrl`. */
  readonly baseUrl?: string | URL;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects 2xx from `GET {baseUrl}/v1/models` with `apiKey` as a bearer token; non-critical by default. Throws `ProbeConfigError` for an empty `apiKey` or an invalid `baseUrl`. */
export function openaiProbe(options: OpenaiProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: "openaiProbe",
    field: "baseUrl",
    value: options.baseUrl ?? openaiDefaultBaseUrl,
    path: "/v1/models",
  });
  if (typeof options.apiKey !== "string" || options.apiKey.length === 0) {
    throw new ProbeConfigError(
      "openaiProbe",
      "apiKey",
      typeof options.apiKey !== "string"
        ? `must be a string, got ${String(options.apiKey)}`
        : "must not be empty",
    );
  }
  const headers = { authorization: `Bearer ${options.apiKey}` };
  return {
    name: options.name ?? openaiDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) => expectOk(doFetch(url, { method: "GET", headers, signal })),
  };
}
