/**
 * Drizzle ORM probe for `@openstatus/health`: runs `select 1` through any Drizzle database.
 *
 * ```ts
 * import { drizzleProbe } from "@openstatus/health-drizzle";
 *
 * const probe = drizzleProbe({ db });
 * ```
 *
 * @module
 */

import { type SQL, sql } from "drizzle-orm";
import {
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
  type ProbeResult,
} from "@openstatus/health";

/** Probe name when `name` is unset. */
export const drizzleDefaultName = "database";

/** The subset of a Drizzle database the probe uses; one of the two methods must exist. */
export interface DrizzleLikeDb {
  /** Postgres and MySQL drivers. */
  execute?(query: SQL): PromiseLike<ProbeResult>;
  /** SQLite drivers. */
  run?(query: SQL): PromiseLike<ProbeResult>;
}

/** Options for `drizzleProbe()`. */
export interface DrizzleProbeOptions extends ProbeOverrides {
  /** A Drizzle database instance. */
  readonly db: DrizzleLikeDb;
}

/** A probe that runs `select 1`; critical by default. Throws `ProbeConfigError` without `execute()` or `run()`. */
export function drizzleProbe(options: DrizzleProbeOptions): Probe {
  const db = options.db;
  const query = sql`select 1`;
  let run: () => PromiseLike<ProbeResult>;
  if (typeof db.execute === "function") {
    run = () => db.execute!(query);
  } else if (typeof db.run === "function") {
    run = () => db.run!(query);
  } else {
    throw new ProbeConfigError(
      "drizzleProbe",
      "db",
      `must expose execute() or run(), got ${describe(db)}`,
    );
  }
  return {
    name: options.name ?? drizzleDefaultName,
    critical: options.critical ?? true,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      await run();
    },
  };
}

function describe(db: DrizzleLikeDb): string {
  if (db == null) return String(db);
  if (typeof db !== "object") return typeof db;
  const keys = Object.keys(db);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
