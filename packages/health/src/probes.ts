/**
 * Probe authoring helpers: `httpProbe`, `expectOk`, `probe` and `probeUrl`.
 *
 * @module
 */

import { ProbeConfigError } from "./errors.ts";
import type { Probe, ProbeOverrides } from "./types.ts";

/**
 * Reject unless the response is 2xx, or exactly `expectStatus` when given.
 * The body is cancelled either way.
 */
export async function expectOk(
  response: Response | Promise<Response>,
  expectStatus?: number,
): Promise<Response> {
  const res = await response;
  const ok = expectStatus == null ? res.ok : res.status === expectStatus;
  try {
    await res.body?.cancel();
  } catch {
    // A body that cannot be cancelled must not turn a good status into a failure.
  }
  if (!ok) throw new Error(`unexpected status ${res.status}`);
  return res;
}

/** Options for `probeUrl()`. */
export interface ProbeUrlOptions {
  /** The factory name for the error message, e.g. `"upstashProbe"`. */
  readonly probe: string;
  /** The option name for the error message, e.g. `"url"`. */
  readonly field: string;
  /** The value to parse. */
  readonly value: string | URL | undefined;
  /** Optional path resolved against the parsed URL. */
  readonly path?: string;
}

/**
 * Parse a URL option at construction, throwing a `ProbeConfigError` that names
 * the probe and field instead of a bare `Invalid URL`.
 */
export function probeUrl(options: ProbeUrlOptions): URL {
  const { probe, field, value, path } = options;
  if (value == null || value === "") {
    throw new ProbeConfigError(
      probe,
      field,
      `must be an absolute URL, got ${value === "" ? '""' : String(value)}`,
    );
  }
  let base: URL;
  try {
    base = new URL(value);
  } catch {
    throw new ProbeConfigError(
      probe,
      field,
      `must be an absolute URL, got ${JSON.stringify(String(value))}`,
    );
  }
  return path == null ? base : new URL(path, base);
}

/** Options for `httpProbe()`. */
export interface HttpProbeOptions extends ProbeOverrides {
  /** Unique probe name. */
  readonly name: string;
  /** Absolute URL to request. */
  readonly url: string | URL;
  /** Request method. Default `"GET"`. */
  readonly method?: "GET" | "HEAD";
  /** Extra request headers. */
  readonly headers?: HeadersInit;
  /** Require this exact status instead of any 2xx. */
  readonly expectStatus?: number;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** A reachability probe for any HTTP endpoint. */
export function httpProbe(options: HttpProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: `httpProbe(${JSON.stringify(options.name)})`,
    field: "url",
    value: options.url,
  });
  return {
    name: options.name,
    critical: options.critical,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) =>
      expectOk(
        doFetch(url, {
          method: options.method ?? "GET",
          headers: options.headers,
          signal,
        }),
        options.expectStatus,
      ),
  };
}

/** Identity helper that gives `run` typed parameters without an annotation. */
export function probe(options: Probe): Probe {
  return options;
}
