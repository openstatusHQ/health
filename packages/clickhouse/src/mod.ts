import {
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
} from "@openstatus/health";

export const clickhouseDefaultName = "clickhouse";

export type ClickHousePingResult =
  | { readonly success: true }
  | { readonly success: false; readonly error: Error };

export interface ClickHousePingParams {
  readonly select?: boolean;
  readonly abort_signal?: AbortSignal;
}

export interface ClickHouseLikeClient {
  ping(params?: ClickHousePingParams): Promise<ClickHousePingResult>;
}

export interface ClickHouseProbeOptions extends ProbeOverrides {
  readonly client: ClickHouseLikeClient;
  readonly select?: boolean;
}

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
      if (!result.success) throw result.error;
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
