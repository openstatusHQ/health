/**
 * Anthropic reachability probe for `@openstatus/health`, against `/v1/models`.
 *
 * ```ts
 * import { anthropicProbe } from "@openstatus/health-anthropic";
 *
 * const probe = anthropicProbe({ apiKey: env.ANTHROPIC_API_KEY });
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
export const anthropicDefaultBaseUrl = "https://api.anthropic.com";
/** Probe name when `name` is unset. */
export const anthropicDefaultName = "anthropic";
/** The `anthropic-version` header sent with the request. */
export const anthropicDefaultVersion = "2023-06-01";

/** Options for `anthropicProbe()`. */
export interface AnthropicProbeOptions extends ProbeOverrides {
  /** An Anthropic API key (`sk-ant-…`). */
  readonly apiKey: string;
  /** API host. Default `anthropicDefaultBaseUrl`. */
  readonly baseUrl?: string | URL;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A probe that expects 2xx from `GET {baseUrl}/v1/models` with `apiKey` in the `x-api-key` header; non-critical by default. Throws `ProbeConfigError` for an empty `apiKey` or an invalid `baseUrl`. */
export function anthropicProbe(options: AnthropicProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: "anthropicProbe",
    field: "baseUrl",
    value: options.baseUrl ?? anthropicDefaultBaseUrl,
    path: "/v1/models",
  });
  if (typeof options.apiKey !== "string" || options.apiKey.length === 0) {
    throw new ProbeConfigError(
      "anthropicProbe",
      "apiKey",
      typeof options.apiKey !== "string"
        ? `must be a string, got ${String(options.apiKey)}`
        : "must not be empty",
    );
  }
  const headers = {
    "x-api-key": options.apiKey,
    "anthropic-version": anthropicDefaultVersion,
  };
  return {
    name: options.name ?? anthropicDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) => expectOk(doFetch(url, { method: "GET", headers, signal })),
  };
}
