import type { Probe, ProbeOverrides } from "@openstatus/health";

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
  const select = options.select ?? true;
  return {
    name: options.name ?? clickhouseDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async (signal) => {
      const result = await options.client.ping({
        select,
        abort_signal: signal,
      });
      if (!result.success) throw result.error;
    },
  };
}
