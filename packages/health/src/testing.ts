/**
 * Test doubles for probes and adapters: fake `fetch` implementations and
 * probes with a known outcome. Import from `@openstatus/health/testing`.
 *
 * @module
 */

import type { JsonValue, Probe } from "./types.ts";

/** One call recorded by `fakeFetch()`. */
export interface FetchCall {
  /** The requested URL as a string. */
  readonly url: string;
  /** The request method. Default `"GET"`. */
  readonly method: string;
  /** The request headers. */
  readonly headers: Headers;
  /** The abort signal passed by the probe, if any. */
  readonly signal?: AbortSignal;
}

/** Options for `fakeFetch()`. */
export interface FakeFetchOptions {
  /** Response status. Default `200`. */
  readonly status?: number;
  /** JSON body; omitted for an empty body. */
  readonly body?: JsonValue;
  /** Observer for every call. */
  readonly onFetch?: (call: FetchCall) => void;
}

/** A `fetch` that answers immediately with the given status and body. */
export function fakeFetch(options: FakeFetchOptions = {}): typeof fetch {
  return (input, init) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;
    const call: FetchCall = {
      url,
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      signal: init?.signal ?? undefined,
    };
    options.onFetch?.(call);
    return Promise.resolve(
      new Response(
        options.body == null ? null : JSON.stringify(options.body),
        { status: options.status ?? 200 },
      ),
    );
  };
}

/** A `fetch` that never resolves; sets `track.aborted` when the signal fires. */
export function hangFetch(track?: { aborted: boolean }): typeof fetch {
  return (_input, init) => {
    if (track != null && init?.signal != null) {
      init.signal.addEventListener("abort", () => {
        track.aborted = true;
      }, { once: true });
    }
    return new Promise<Response>(() => {});
  };
}

/** A probe that always succeeds. */
export function okProbe(name: string, critical = false): Probe {
  return { name, critical, run: () => {} };
}

/** A probe that always throws `error`. */
export function failingProbe(
  name: string,
  critical = false,
  error: Error = new Error(`${name} failed`),
): Probe {
  return {
    name,
    critical,
    run: () => {
      throw error;
    },
  };
}

/** A probe that only settles when its signal aborts. */
export function hangingProbe(
  name: string,
  critical = false,
  timeoutMs?: number,
): Probe {
  return {
    name,
    critical,
    timeoutMs,
    run: (signal) =>
      new Promise<void>((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
  };
}
