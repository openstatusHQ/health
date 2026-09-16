/**
 * Turso / libSQL probe for `@openstatus/health`, built on `@libsql/client`.
 *
 * ```ts
 * import { createClient } from "@libsql/client";
 * import { tursoProbe } from "@openstatus/health-turso";
 *
 * const probe = tursoProbe({ client: createClient({ url, authToken }) });
 * ```
 *
 * @module
 */

import type { Probe, ProbeOverrides, ProbeResult } from "@openstatus/health";

/** Probe name when `name` is unset. */
export const tursoDefaultName = "database";

/** The subset of `@libsql/client` the probe uses. */
export interface LibsqlLikeClient {
  /** Run one statement. */
  execute(sql: string): Promise<ProbeResult>;
}

/** Options for `tursoProbe()`. */
export interface TursoProbeOptions extends ProbeOverrides {
  /** A libSQL client. */
  readonly client: LibsqlLikeClient;
}

/** A probe that runs `select 1`; critical by default. */
export function tursoProbe(options: TursoProbeOptions): Probe {
  return {
    name: options.name ?? tursoDefaultName,
    critical: options.critical ?? true,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: () => options.client.execute("select 1"),
  };
}
