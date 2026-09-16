/**
 * Postgres probe for `@openstatus/health`: runs `select 1` through `pg`,
 * postgres.js, `@neondatabase/serverless`, `@vercel/postgres` or any client
 * with a `query()` or `unsafe()` method.
 *
 * ```ts
 * import { Pool } from "pg";
 * import { postgresProbe } from "@openstatus/health-postgres";
 *
 * const probe = postgresProbe({ client: new Pool({ connectionString }) });
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
export const postgresDefaultName = "database";

/** The subset of a Postgres client the probe uses; one of the two methods must exist. */
export interface PostgresLikeClient {
  /** `pg` pools and clients, `@vercel/postgres`, Neon's `Pool` and `sql.query()`. */
  query?(text: string): PromiseLike<ProbeResult>;
  /** postgres.js's `sql.unsafe()`. */
  unsafe?(query: string): PromiseLike<ProbeResult>;
}

/** Options for `postgresProbe()`. */
export interface PostgresProbeOptions extends ProbeOverrides {
  /** A Postgres pool, client or postgres.js `sql` instance. */
  readonly client: PostgresLikeClient;
}

/** A probe that runs `select 1`; critical by default. Throws `ProbeConfigError` without `query()` or `unsafe()`. */
export function postgresProbe(options: PostgresProbeOptions): Probe {
  const client = options.client;
  let run: () => PromiseLike<ProbeResult>;
  if (typeof client?.query === "function") {
    run = () => client.query!("select 1");
  } else if (typeof client?.unsafe === "function") {
    run = () => client.unsafe!("select 1");
  } else {
    throw new ProbeConfigError(
      "postgresProbe",
      "client",
      `must expose query() or unsafe(), got ${describe(client)}`,
    );
  }
  return {
    name: options.name ?? postgresDefaultName,
    critical: options.critical ?? true,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      await run();
    },
  };
}

function describe(client: PostgresLikeClient): string {
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
