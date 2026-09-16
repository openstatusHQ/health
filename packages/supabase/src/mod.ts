/**
 * Supabase Postgres connection-pressure probe for `@openstatus/health`, via an RPC you create once.
 *
 * ```ts
 * import { createClient } from "@supabase/supabase-js";
 * import { supabaseProbe } from "@openstatus/health-supabase";
 *
 * const client = createClient(url, serviceRoleKey);
 * const probe = supabaseProbe({ client });
 * ```
 *
 * @module
 */

import {
  type JsonObject,
  type JsonValue,
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
} from "@openstatus/health";

/** Probe name when `name` is unset. */
export const supabaseDefaultName = "supabase";
/** RPC function called when `rpc` is unset. */
export const supabaseDefaultRpc = "health_connection_pressure";
/** Threshold when `maxConnectionPercent` is unset. */
export const supabaseDefaultMaxConnectionPercent = 90;

/** The row returned by the connection-pressure RPC. */
export interface SupabaseConnectionPressureRow {
  /** Rows in `pg_stat_activity`. */
  readonly current_connections: number;
  /** Connections in state `active`. */
  readonly active_connections: number;
  /** Connections with a `wait_event_type`. */
  readonly waiting_connections: number;
  /** The `max_connections` setting. */
  readonly max_connections: number;
  /** `current_connections` as a percentage of `max_connections`. */
  readonly connection_percent: number;
}

/** What an RPC call resolves with as `data`. */
export type SupabaseRpcData = JsonValue | undefined;

/** The `error` of a failed RPC call. */
export interface SupabaseRpcError {
  /** Human-readable reason. */
  readonly message: string;
}

/** What an RPC builder resolves to. */
export interface SupabaseRpcResult {
  /** The rows, or `null` on error. */
  readonly data: SupabaseRpcData;
  /** The error, or `null` on success. */
  readonly error: SupabaseRpcError | null;
}

/** The subset of a supabase-js RPC builder the probe uses. */
export interface SupabaseRpcBuilder extends PromiseLike<SupabaseRpcResult> {
  /** Attach the probe's timeout signal. */
  readonly abortSignal: (signal: AbortSignal) => SupabaseRpcBuilder;
}

/** The subset of a supabase-js client the probe uses. */
export interface SupabaseLikeClient {
  /** Call a Postgres function. */
  rpc(fn: string, args?: JsonObject): SupabaseRpcBuilder;
}

/** Options for `supabaseProbe()`. */
export interface SupabaseProbeOptions extends ProbeOverrides {
  /** A supabase-js client using a key the RPC is granted to. */
  readonly client: SupabaseLikeClient;
  /** RPC function name. Default `supabaseDefaultRpc`. */
  readonly rpc?: string;
  /** Fail above this `connection_percent`. Default `supabaseDefaultMaxConnectionPercent`. */
  readonly maxConnectionPercent?: number;
}

/** Thrown by the probe when `connection_percent` exceeds `maxConnectionPercent`. */
export class SupabaseConnectionPressureError extends Error {
  /** The row that crossed the threshold. */
  readonly row: SupabaseConnectionPressureRow;

  /** Build the error for `row` against the `max` percentage. */
  constructor(row: SupabaseConnectionPressureRow, max: number) {
    super(`connection pressure ${row.connection_percent}% exceeds ${max}%`);
    this.name = "SupabaseConnectionPressureError";
    this.row = row;
  }
}

/** A probe that calls the RPC and fails on error, an unexpected row shape or high pressure; non-critical by default. Throws `ProbeConfigError` for a negative `maxConnectionPercent`. */
export function supabaseProbe(options: SupabaseProbeOptions): Probe {
  const rpc = options.rpc ?? supabaseDefaultRpc;
  const maxConnectionPercent = options.maxConnectionPercent ??
    supabaseDefaultMaxConnectionPercent;
  if (!Number.isFinite(maxConnectionPercent) || maxConnectionPercent < 0) {
    throw new ProbeConfigError(
      "supabaseProbe",
      "maxConnectionPercent",
      `must be a non-negative number, got ${
        String(options.maxConnectionPercent)
      }`,
    );
  }
  return {
    name: options.name ?? supabaseDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async (signal) => {
      let builder = options.client.rpc(rpc);
      if (typeof builder.abortSignal === "function") {
        builder = builder.abortSignal(signal);
      }
      const { data, error } = await builder;
      if (error != null) throw new Error(error.message);
      return assertWithinThreshold(data, maxConnectionPercent);
    },
  };
}

function assertWithinThreshold(
  data: SupabaseRpcData,
  max: number,
): SupabaseConnectionPressureRow {
  const first = Array.isArray(data) ? data[0] : data;
  if (first == null || typeof first !== "object" || Array.isArray(first)) {
    throw new Error("unexpected response shape");
  }
  const percent = first.connection_percent;
  if (typeof percent !== "number" || !Number.isFinite(percent)) {
    throw new Error("unexpected response shape");
  }
  const row: SupabaseConnectionPressureRow = {
    current_connections: numberOr(first.current_connections, 0),
    active_connections: numberOr(first.active_connections, 0),
    waiting_connections: numberOr(first.waiting_connections, 0),
    max_connections: numberOr(first.max_connections, 0),
    connection_percent: percent,
  };
  if (percent > max) throw new SupabaseConnectionPressureError(row, max);
  return row;
}

function numberOr(value: JsonValue | undefined, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}
