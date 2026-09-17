/**
 * ClickHouse probe for `@openstatus/health`, built on the client's `ping()`.
 *
 * ```ts
 * import { createClient } from "@clickhouse/client";
 * import { clickhouseProbe } from "@openstatus/health-clickhouse";
 *
 * const probe = clickhouseProbe({ client: createClient({ url }) });
 * ```
 *
 * @module
 */

import {
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
} from "@openstatus/health";

/** Probe name when `name` is unset. */
export const clickhouseDefaultName = "clickhouse";

/** What `ping()` resolves to. */
export type ClickHousePingResult =
  | { readonly success: true }
  | { readonly success: false; readonly error: Error };

/** What the probe passes to `ping()`. */
export interface ClickHousePingParams {
  /** Run `SELECT 1` instead of hitting `/ping`. */
  readonly select?: boolean;
  /** Aborts when the probe times out. */
  readonly abort_signal?: AbortSignal;
}

/** The subset of `@clickhouse/client` the probe uses. */
export interface ClickHouseLikeClient {
  /** Check connectivity. */
  ping(params?: ClickHousePingParams): Promise<ClickHousePingResult>;
}

/** Options for `clickhouseProbe()`. */
export interface ClickHouseProbeOptions extends ProbeOverrides {
  /** A `@clickhouse/client` client. */
  readonly client: ClickHouseLikeClient;
  /** Ping with `SELECT 1`. Default `true`. */
  readonly select?: boolean;
}

/** A probe that calls `client.ping()`; non-critical by default. Throws `ProbeConfigError` without a `ping()`. */
export function clickhouseProbe(options: ClickHouseProbeOptions): Probe {
  const client = options.client;
  if (typeof client?.ping !== "function") {
    throw new ProbeConfigError(
      "clickhouseProbe",
      "client",
      `must expose ping(), got ${describe(client)}`,
    );
  }
  const select = options.select ?? true;
  return {
    name: options.name ?? clickhouseDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async (signal) => {
      const result = await client.ping({ select, abort_signal: signal });
      if (!result.success) {
        throw result.error ?? new Error("unexpected ping result");
      }
    },
  };
}

function describe(client: ClickHouseLikeClient): string {
  if (client == null) return String(client);
  if (typeof client !== "object") return typeof client;
  const keys = Object.keys(client);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
