/**
 * Turso serverless probe for `@openstatus/health`, built on `@tursodatabase/serverless`.
 *
 * ```ts
 * import { connect } from "@tursodatabase/serverless";
 * import { tursoServerlessProbe } from "@openstatus/health-turso-serverless";
 *
 * const probe = tursoServerlessProbe({ connection: connect({ url, authToken }) });
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
export const tursoServerlessDefaultName = "database";

/** The subset of a `@tursodatabase/serverless` connection the probe uses. */
export interface TursoServerlessConnection {
  /** Run one statement and return the first row. */
  get(sql: string): PromiseLike<ProbeResult>;
}

/** Options for `tursoServerlessProbe()`. */
export interface TursoServerlessProbeOptions extends ProbeOverrides {
  /** A serverless connection. */
  readonly connection: TursoServerlessConnection;
}

/** A probe that runs `select 1`; critical by default. Throws `ProbeConfigError` without `get()`. */
export function tursoServerlessProbe(
  options: TursoServerlessProbeOptions,
): Probe {
  const connection = options.connection;
  if (typeof connection?.get !== "function") {
    throw new ProbeConfigError(
      "tursoServerlessProbe",
      "connection",
      `must expose get(), got ${describe(connection)}`,
    );
  }
  return {
    name: options.name ?? tursoServerlessDefaultName,
    critical: options.critical ?? true,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      await connection.get("select 1");
    },
  };
}

function describe(connection: TursoServerlessConnection): string {
  if (connection == null) return String(connection);
  if (typeof connection !== "object") return typeof connection;
  const keys = Object.keys(connection);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
