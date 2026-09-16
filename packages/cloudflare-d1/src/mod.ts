/**
 * Cloudflare D1 probe for `@openstatus/health`: runs `select 1` through a
 * Workers `D1Database` binding.
 *
 * ```ts
 * import { d1Probe } from "@openstatus/health-cloudflare-d1";
 *
 * export default {
 *   fetch: (request, env) =>
 *     createHealthHandler({ probes: [d1Probe({ db: env.DB })] })(request),
 * };
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
export const d1DefaultName = "database";

/** The subset of a `D1PreparedStatement` the probe uses. */
export interface D1LikeStatement {
  /** Run the statement and resolve with the first row. */
  first(): PromiseLike<ProbeResult>;
}

/** The subset of a `D1Database` binding the probe uses. */
export interface D1LikeDatabase {
  /** Prepare one statement. */
  prepare(query: string): D1LikeStatement;
}

/** Options for `d1Probe()`. */
export interface D1ProbeOptions extends ProbeOverrides {
  /** The `D1Database` binding from `env`. */
  readonly db: D1LikeDatabase;
}

/** A probe that runs `select 1`; critical by default. Throws `ProbeConfigError` without `prepare()`. */
export function d1Probe(options: D1ProbeOptions): Probe {
  const db = options.db;
  if (typeof db?.prepare !== "function") {
    throw new ProbeConfigError(
      "d1Probe",
      "db",
      `must expose prepare(), got ${describe(db)}`,
    );
  }
  return {
    name: options.name ?? d1DefaultName,
    critical: options.critical ?? true,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      await db.prepare("select 1").first();
    },
  };
}

function describe(db: D1LikeDatabase): string {
  if (db == null) return String(db);
  if (typeof db !== "object") return typeof db;
  const keys = Object.keys(db);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
