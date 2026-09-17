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

import {
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
  type ProbeResult,
} from "@openstatus/health";

/** Probe name when `name` is unset. */
export const tursoDefaultName = "database";

/** The subset of `@libsql/client` the probe uses. */
export interface LibsqlLikeClient {
  /** Run one statement. */
  execute(sql: string): PromiseLike<ProbeResult>;
}

/** Options for `tursoProbe()`. */
export interface TursoProbeOptions extends ProbeOverrides {
  /** A libSQL client. */
  readonly client: LibsqlLikeClient;
}

/** A probe that runs `select 1`; critical by default. Throws `ProbeConfigError` without `execute()`. */
export function tursoProbe(options: TursoProbeOptions): Probe {
  const client = options.client;
  if (typeof client?.execute !== "function") {
    throw new ProbeConfigError(
      "tursoProbe",
      "client",
      `must expose execute(), got ${describe(client)}`,
    );
  }
  return {
    name: options.name ?? tursoDefaultName,
    critical: options.critical ?? true,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      await client.execute("select 1");
    },
  };
}

function describe(client: LibsqlLikeClient): string {
  if (client == null) return String(client);
  if (typeof client !== "object") return typeof client;
  const keys = Object.keys(client);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
