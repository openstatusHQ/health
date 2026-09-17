/**
 * PlanetScale probe for `@openstatus/health`: runs `select 1` over the
 * serverless HTTP driver from `@planetscale/database`.
 *
 * ```ts
 * import { connect } from "@planetscale/database";
 * import { planetscaleProbe } from "@openstatus/health-planetscale";
 *
 * const probe = planetscaleProbe({ connection: connect({ url }) });
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
export const planetscaleDefaultName = "database";

/** The subset of a `@planetscale/database` `Connection` or `Client` the probe uses. */
export interface PlanetScaleLikeConnection {
  /** Run one statement. */
  execute(query: string): PromiseLike<ProbeResult>;
}

/** Options for `planetscaleProbe()`. */
export interface PlanetScaleProbeOptions extends ProbeOverrides {
  /** A `connect()` connection or a `Client`. */
  readonly connection: PlanetScaleLikeConnection;
}

/** A probe that runs `select 1`; critical by default. The driver's `execute()` takes no `AbortSignal`, so a timed-out request is not cancelled. Throws `ProbeConfigError` without `execute()`. */
export function planetscaleProbe(options: PlanetScaleProbeOptions): Probe {
  const connection = options.connection;
  if (typeof connection?.execute !== "function") {
    throw new ProbeConfigError(
      "planetscaleProbe",
      "connection",
      `must expose execute(), got ${describe(connection)}`,
    );
  }
  return {
    name: options.name ?? planetscaleDefaultName,
    critical: options.critical ?? true,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      await connection.execute("select 1");
    },
  };
}

function describe(connection: PlanetScaleLikeConnection): string {
  if (connection == null) return String(connection);
  if (typeof connection !== "object") return typeof connection;
  const keys = Object.keys(connection);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
