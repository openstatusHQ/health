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

import type { Probe, ProbeOverrides, ProbeResult } from "@openstatus/health";

/** Probe name when `name` is unset. */
export const tursoServerlessDefaultName = "database";

/** The subset of a `@tursodatabase/serverless` connection the probe uses. */
export interface TursoServerlessConnection {
  /** Run one statement and return the first row. */
  get(sql: string): Promise<ProbeResult>;
}

/** Options for `tursoServerlessProbe()`. */
export interface TursoServerlessProbeOptions extends ProbeOverrides {
  /** A serverless connection. */
  readonly connection: TursoServerlessConnection;
}

/** A probe that runs `select 1`; critical by default. */
export function tursoServerlessProbe(
  options: TursoServerlessProbeOptions,
): Probe {
  return {
    name: options.name ?? tursoServerlessDefaultName,
    critical: options.critical ?? true,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: () => options.connection.get("select 1"),
  };
}
