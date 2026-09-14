import type { JsonObject } from "@openstatus/health";
import { omitFields, readEnv } from "@openstatus/health";

export type RailwayServerInfo = {
  readonly platform: "railway";
  readonly region?: string;
  readonly instanceId?: string;
  readonly service?: string;
  readonly version?: string;
  readonly environment?: string;
  readonly project?: string;
  readonly commitSha?: string;
};

export type RailwayServerOptions = {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly omit?: readonly (keyof RailwayServerInfo)[];
};

function text(value: string | undefined): string | undefined {
  return value == null || value === "" ? undefined : value;
}

export function railwayServer(
  options?: RailwayServerOptions,
): RailwayServerInfo | undefined {
  const env = options?.env;
  const instanceId = text(readEnv("RAILWAY_REPLICA_ID", env));
  const service = text(readEnv("RAILWAY_SERVICE_NAME", env));
  if (instanceId == null && service == null) return undefined;

  const region = text(readEnv("RAILWAY_REPLICA_REGION", env));
  const version = text(readEnv("RAILWAY_DEPLOYMENT_ID", env));
  const environment = text(readEnv("RAILWAY_ENVIRONMENT_NAME", env));
  const project = text(readEnv("RAILWAY_PROJECT_NAME", env));
  const commitSha = text(readEnv("RAILWAY_GIT_COMMIT_SHA", env));

  const info: RailwayServerInfo = {
    platform: "railway",
    ...(region != null ? { region } : {}),
    ...(instanceId != null ? { instanceId } : {}),
    ...(service != null ? { service } : {}),
    ...(version != null ? { version } : {}),
    ...(environment != null ? { environment } : {}),
    ...(project != null ? { project } : {}),
    ...(commitSha != null ? { commitSha } : {}),
  };
  return omitFields(info, options?.omit);
}

export function railwayExtend(
  options?: RailwayServerOptions,
): () => JsonObject {
  let cached: JsonObject | undefined;
  return (): JsonObject => {
    if (cached == null) {
      const server = railwayServer(options);
      cached = server == null ? {} : { server };
    }
    return cached;
  };
}
