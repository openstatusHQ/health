import {
  type JsonObject,
  type JsonValue,
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
} from "@openstatus/health";

export const supabaseDefaultName = "supabase";
export const supabaseDefaultRpc = "health_connection_pressure";
export const supabaseDefaultMaxConnectionPercent = 90;

export interface SupabaseConnectionPressureRow {
  readonly current_connections: number;
  readonly active_connections: number;
  readonly waiting_connections: number;
  readonly max_connections: number;
  readonly connection_percent: number;
}

export type SupabaseRpcData = JsonValue | undefined;

export interface SupabaseRpcError {
  readonly message: string;
}

export interface SupabaseRpcResult {
  readonly data: SupabaseRpcData;
  readonly error: SupabaseRpcError | null;
}

export interface SupabaseRpcBuilder extends PromiseLike<SupabaseRpcResult> {
  readonly abortSignal: (signal: AbortSignal) => SupabaseRpcBuilder;
}

export interface SupabaseLikeClient {
  rpc(fn: string, args?: JsonObject): SupabaseRpcBuilder;
}

export interface SupabaseProbeOptions extends ProbeOverrides {
  readonly client: SupabaseLikeClient;
  readonly rpc?: string;
  readonly maxConnectionPercent?: number;
}

export class SupabaseConnectionPressureError extends Error {
  readonly row: SupabaseConnectionPressureRow;

  constructor(row: SupabaseConnectionPressureRow, max: number) {
    super(`connection pressure ${row.connection_percent}% exceeds ${max}%`);
    this.name = "SupabaseConnectionPressureError";
    this.row = row;
  }
}

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
