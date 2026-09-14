import type { JsonObject } from "@openstatus/health";
import { omitFields, readEnv } from "@openstatus/health";

export type KoyebServerInfo = {
  readonly platform: "koyeb";
  readonly region?: string;
  readonly instanceId?: string;
  readonly service?: string;
  readonly version?: string;
  readonly app?: string;
  readonly datacenter?: string;
  readonly replicaIndex?: number;
  readonly instanceType?: string;
};

export type KoyebServerOptions = {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly omit?: readonly (keyof KoyebServerInfo)[];
};

function text(value: string | undefined): string | undefined {
  return value == null || value === "" ? undefined : value;
}

function count(value: string | undefined): number | undefined {
  if (text(value) == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function koyebServer(
  options?: KoyebServerOptions,
): KoyebServerInfo | undefined {
  const env = options?.env;
  const instanceId = text(readEnv("KOYEB_INSTANCE_ID", env));
  if (instanceId == null) return undefined;

  const region = text(readEnv("KOYEB_REGION", env));
  const service = text(readEnv("KOYEB_SERVICE_NAME", env));
  const version = text(readEnv("KOYEB_REGIONAL_DEPLOYMENT_ID", env));
  const app = text(readEnv("KOYEB_APP_NAME", env));
  const datacenter = text(readEnv("KOYEB_DC", env));
  const replicaIndex = count(readEnv("KOYEB_REPLICA_INDEX", env));
  const instanceType = text(readEnv("KOYEB_INSTANCE_TYPE", env));

  const info: KoyebServerInfo = {
    platform: "koyeb",
    ...(region != null ? { region } : {}),
    instanceId,
    ...(service != null ? { service } : {}),
    ...(version != null ? { version } : {}),
    ...(app != null ? { app } : {}),
    ...(datacenter != null ? { datacenter } : {}),
    ...(replicaIndex != null ? { replicaIndex } : {}),
    ...(instanceType != null ? { instanceType } : {}),
  };
  return omitFields(info, options?.omit);
}

export function koyebExtend(options?: KoyebServerOptions): () => JsonObject {
  let cached: JsonObject | undefined;
  return (): JsonObject => {
    if (cached == null) {
      const server = koyebServer(options);
      cached = server == null ? {} : { server };
    }
    return cached;
  };
}
