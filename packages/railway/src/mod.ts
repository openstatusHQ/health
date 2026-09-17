/**
 * Railway server metadata for `@openstatus/health`: renders the region,
 * replica and deployment that produced the response under a `server` key.
 *
 * ```ts
 * import { railwayExtend } from "@openstatus/health-railway";
 *
 * healthRoute({ probes: [], extend: railwayExtend() });
 * ```
 *
 * @module
 */

import type { JsonObject, ServerEnvOptions } from "@openstatus/health";
import { omitFields, readEnvText, serverExtend } from "@openstatus/health";

/** The `server` object rendered on Railway; fields Railway does not set are absent. */
export type RailwayServerInfo = {
  /** Always `"railway"`. */
  readonly platform: "railway";
  /** `RAILWAY_REPLICA_REGION`. */
  readonly region?: string;
  /** `RAILWAY_REPLICA_ID`. */
  readonly instanceId?: string;
  /** `RAILWAY_SERVICE_NAME`. */
  readonly service?: string;
  /** `RAILWAY_DEPLOYMENT_ID`. */
  readonly version?: string;
  /** `RAILWAY_ENVIRONMENT_NAME`. */
  readonly environment?: string;
  /** `RAILWAY_PROJECT_NAME`. */
  readonly project?: string;
  /** `RAILWAY_GIT_COMMIT_SHA`. */
  readonly commitSha?: string;
};

/** Options for `railwayServer()` and `railwayExtend()`. */
export type RailwayServerOptions<
  K extends keyof RailwayServerInfo = keyof RailwayServerInfo,
> = ServerEnvOptions<RailwayServerInfo, K>;

/** Read Railway metadata from the environment; `undefined` off Railway. */
export function railwayServer<K extends keyof RailwayServerInfo = never>(
  options?: RailwayServerOptions<K>,
): Omit<RailwayServerInfo, K> | undefined {
  const env = options?.env;
  const instanceId = readEnvText("RAILWAY_REPLICA_ID", env);
  const service = readEnvText("RAILWAY_SERVICE_NAME", env);
  if (instanceId == null && service == null) return undefined;

  const region = readEnvText("RAILWAY_REPLICA_REGION", env);
  const version = readEnvText("RAILWAY_DEPLOYMENT_ID", env);
  const environment = readEnvText("RAILWAY_ENVIRONMENT_NAME", env);
  const project = readEnvText("RAILWAY_PROJECT_NAME", env);
  const commitSha = readEnvText("RAILWAY_GIT_COMMIT_SHA", env);

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

/** An `extend` hook that renders `{ server }` on Railway and `{}` elsewhere, computed once. */
export function railwayExtend<K extends keyof RailwayServerInfo = never>(
  options?: RailwayServerOptions<K>,
): () => JsonObject {
  return serverExtend(() => railwayServer(options));
}
