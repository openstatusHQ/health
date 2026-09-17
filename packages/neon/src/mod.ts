/**
 * Neon serverless Postgres probe for `@openstatus/health`: runs `select 1`
 * over the HTTP driver, or a `Pool` / `Client`, from `@neondatabase/serverless`.
 *
 * ```ts
 * import { neon } from "@neondatabase/serverless";
 * import { neonProbe } from "@openstatus/health-neon";
 *
 * const probe = neonProbe({ client: neon(env.DATABASE_URL) });
 * ```
 *
 * @module
 */

import {
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
  type ProbeResult,
} from "@openstatus/health";

/** Probe name when `name` is unset. */
export const neonDefaultName = "database";

/** What the probe passes to the HTTP driver's `query()` after the statement. */
export interface NeonQueryOptions {
  /** Merged into the `fetch` call; carries the probe's `AbortSignal`. */
  readonly fetchOptions?: { readonly signal?: AbortSignal };
}

/** The subset of `@neondatabase/serverless` the probe uses: `neon()`'s `sql.query()`, or `Pool` / `Client`. */
export interface NeonLikeClient {
  /** Run one statement; the HTTP driver also receives `params` and `options`. */
  query(
    text: string,
    params?: never[],
    options?: NeonQueryOptions,
  ): PromiseLike<ProbeResult>;
}

/** Options for `neonProbe()`. */
export interface NeonProbeOptions extends ProbeOverrides {
  /** The `sql` function from `neon()`, or a `Pool` / `Client`. */
  readonly client: NeonLikeClient;
}

/** A probe that runs `select 1`; critical by default. The HTTP driver from `neon()` receives the probe's `AbortSignal` through `fetchOptions`; `Pool` / `Client` take no signal. Throws `ProbeConfigError` without `query()`. */
export function neonProbe(options: NeonProbeOptions): Probe {
  const client = options.client;
  if (typeof client?.query !== "function") {
    throw new ProbeConfigError(
      "neonProbe",
      "client",
      `must expose query(), got ${describe(client)}`,
    );
  }
  const httpDriver = isCallable(client);
  return {
    name: options.name ?? neonDefaultName,
    critical: options.critical ?? true,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async (signal) => {
      if (httpDriver) {
        await client.query("select 1", [], { fetchOptions: { signal } });
      } else {
        await client.query("select 1");
      }
    },
  };
}

function isCallable(client: object): boolean {
  return typeof client === "function";
}

function describe(client: NeonLikeClient): string {
  if (client == null) return String(client);
  if (typeof client !== "object" && typeof client !== "function") {
    return typeof client;
  }
  const keys = Object.keys(client);
  return keys.length === 0
    ? `${
      typeof client === "function" ? "a function" : "an object"
    } with no keys`
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
