import type { JsonObject } from "@openstatus/health";
import { omitFields, readEnv } from "@openstatus/health";

export type FlyServerInfo = {
  readonly platform: "fly";
  readonly region?: string;
  readonly instanceId?: string;
  readonly service?: string;
  readonly version?: string;
  readonly primaryRegion?: string;
  readonly processGroup?: string;
  readonly machineVersion?: string;
  readonly memoryMb?: number;
};

export type FlyServerOptions = {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly omit?: readonly (keyof FlyServerInfo)[];
};

function text(value: string | undefined): string | undefined {
  return value == null || value === "" ? undefined : value;
}

function count(value: string | undefined): number | undefined {
  if (text(value) == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function flyServer(
  options?: FlyServerOptions,
): FlyServerInfo | undefined {
  const env = options?.env;
  const instanceId = text(readEnv("FLY_MACHINE_ID", env)) ??
    text(readEnv("FLY_ALLOC_ID", env));
  const service = text(readEnv("FLY_APP_NAME", env));
  if (instanceId == null && service == null) return undefined;

  const region = text(readEnv("FLY_REGION", env));
  const version = text(readEnv("FLY_IMAGE_REF", env));
  const primaryRegion = text(readEnv("PRIMARY_REGION", env));
  const processGroup = text(readEnv("FLY_PROCESS_GROUP", env));
  const machineVersion = text(readEnv("FLY_MACHINE_VERSION", env));
  const memoryMb = count(readEnv("FLY_VM_MEMORY_MB", env));

  const info: FlyServerInfo = {
    platform: "fly",
    ...(region != null ? { region } : {}),
    ...(instanceId != null ? { instanceId } : {}),
    ...(service != null ? { service } : {}),
    ...(version != null ? { version } : {}),
    ...(primaryRegion != null ? { primaryRegion } : {}),
    ...(processGroup != null ? { processGroup } : {}),
    ...(machineVersion != null ? { machineVersion } : {}),
    ...(memoryMb != null ? { memoryMb } : {}),
  };
  return omitFields(info, options?.omit);
}

export function flyExtend(options?: FlyServerOptions): () => JsonObject {
  let cached: JsonObject | undefined;
  return (): JsonObject => {
    if (cached == null) {
      const server = flyServer(options);
      cached = server == null ? {} : { server };
    }
    return cached;
  };
}
