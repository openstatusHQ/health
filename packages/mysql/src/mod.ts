/**
 * MySQL / MariaDB probe for `@openstatus/health`: runs `select 1` through a
 * `mysql2/promise` pool or connection, or any client with a promise-returning
 * `query()`.
 *
 * ```ts
 * import { createPool } from "mysql2/promise";
 * import { mysqlProbe } from "@openstatus/health-mysql";
 *
 * const probe = mysqlProbe({ client: createPool(env.DATABASE_URL) });
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
export const mysqlDefaultName = "database";

/** The subset of a `mysql2/promise` pool or connection the probe uses. */
export interface MysqlLikeClient {
  /** Run one statement and resolve when the server answers. */
  query(sql: string): PromiseLike<ProbeResult>;
}

/** Options for `mysqlProbe()`. */
export interface MysqlProbeOptions extends ProbeOverrides {
  /** A `mysql2/promise` pool or connection. */
  readonly client: MysqlLikeClient;
}

/** A probe that runs `select 1`; critical by default. Throws `ProbeConfigError` without `query()`. */
export function mysqlProbe(options: MysqlProbeOptions): Probe {
  const client = options.client;
  if (typeof client?.query !== "function") {
    throw new ProbeConfigError(
      "mysqlProbe",
      "client",
      `must expose query(), got ${describe(client)}`,
    );
  }
  return {
    name: options.name ?? mysqlDefaultName,
    critical: options.critical ?? true,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      const pending = client.query("select 1");
      if (pending == null || typeof pending.then !== "function") {
        throw new Error(
          "query() did not return a promise; pass a mysql2/promise client",
        );
      }
      await pending;
    },
  };
}

function describe(client: MysqlLikeClient): string {
  if (client == null) return String(client);
  if (typeof client !== "object") return typeof client;
  const keys = Object.keys(client);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
