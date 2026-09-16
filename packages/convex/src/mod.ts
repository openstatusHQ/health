/**
 * Convex probe for `@openstatus/health`: runs one query function over the
 * deployment's HTTP API (`POST /api/query`) and fails unless it succeeds.
 *
 * ```ts
 * import { convexProbe } from "@openstatus/health-convex";
 *
 * const probe = convexProbe({ url: env.CONVEX_URL, path: "health:ping" });
 * ```
 *
 * @module
 */

import {
  type JsonObject,
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
  probeUrl,
} from "@openstatus/health";

/** Probe name when `name` is unset. */
export const convexDefaultName = "database";

/** Options for `convexProbe()`. */
export interface ConvexProbeOptions extends ProbeOverrides {
  /** The deployment URL, e.g. `https://happy-animal-123.convex.cloud`. */
  readonly url: string | URL;
  /** The query function to run, as `module:function`, e.g. `"health:ping"`. */
  readonly path: string;
  /** Arguments for the query. Default `{}`. */
  readonly args?: JsonObject;
  /** A deploy key or user token, sent as a bearer token when the query requires auth. */
  readonly token?: string;
  /** Replacement `fetch`, for tests. */
  readonly fetch?: typeof fetch;
}

/** What `POST /api/query` answers. */
export type ConvexQueryResponse =
  | { readonly status: "success" }
  | { readonly status: "error"; readonly errorMessage?: string };

/** A probe that runs `path` over the HTTP API and expects `status: "success"`; critical by default. Throws `ProbeConfigError` for an invalid `url`, an empty `path` or an empty `token`. */
export function convexProbe(options: ConvexProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: "convexProbe",
    field: "url",
    value: options.url,
    path: "/api/query",
  });
  if (typeof options.path !== "string" || options.path.length === 0) {
    throw new ProbeConfigError(
      "convexProbe",
      "path",
      typeof options.path !== "string"
        ? `must be a string, got ${String(options.path)}`
        : "must not be empty",
    );
  }
  if (options.token != null && options.token.length === 0) {
    throw new ProbeConfigError("convexProbe", "token", "must not be empty");
  }
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (options.token != null) headers.authorization = `Bearer ${options.token}`;
  const body = JSON.stringify({
    path: options.path,
    args: options.args ?? {},
    format: "json",
  });
  return {
    name: options.name ?? convexDefaultName,
    critical: options.critical ?? true,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async (signal) => {
      const res = await doFetch(url, { method: "POST", headers, body, signal });
      if (!res.ok) {
        await res.body?.cancel();
        throw new Error(`unexpected status ${res.status}`);
      }
      const result: ConvexQueryResponse | null = await res.json()
        .catch(() => null);
      if (result?.status === "success") return;
      if (result?.status === "error") {
        throw new Error(result.errorMessage ?? "query failed");
      }
      throw new Error("unexpected response shape");
    },
  };
}
