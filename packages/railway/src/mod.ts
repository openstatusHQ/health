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

import type { JsonObject } from "@openstatus/health";
import { omitFields, readEnv } from "@openstatus/health";

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
export type RailwayServerOptions = {
  /** Environment to read instead of the process environment; for tests. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Fields to leave out of the rendered object. */
  readonly omit?: readonly (keyof RailwayServerInfo)[];
};

function text(value: string | undefined): string | undefined {
  return value == null || value === "" ? undefined : value;
}

/** Read Railway metadata from the environment; `undefined` off Railway. */
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

/** An `extend` hook that renders `{ server }` on Railway and `{}` elsewhere, computed once. */
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
