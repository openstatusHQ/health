/**
 * Fly.io server metadata for `@openstatus/health`: renders the region,
 * machine and deployment that produced the response under a `server` key.
 *
 * ```ts
 * import { flyExtend } from "@openstatus/health-fly";
 *
 * healthRoute({ probes: [], extend: flyExtend() });
 * ```
 *
 * @module
 */

import type { JsonObject, ServerEnvOptions } from "@openstatus/health";
import {
  omitFields,
  readEnvCount,
  readEnvText,
  serverExtend,
} from "@openstatus/health";

/** The `server` object rendered on Fly.io; fields Fly does not set are absent. */
export type FlyServerInfo = {
  /** Always `"fly"`. */
  readonly platform: "fly";
  /** `FLY_REGION`. */
  readonly region?: string;
  /** `FLY_MACHINE_ID`, falling back to `FLY_ALLOC_ID`. */
  readonly instanceId?: string;
  /** `FLY_APP_NAME`. */
  readonly service?: string;
  /** `FLY_IMAGE_REF`. */
  readonly version?: string;
  /** `PRIMARY_REGION`. */
  readonly primaryRegion?: string;
  /** `FLY_PROCESS_GROUP`. */
  readonly processGroup?: string;
  /** `FLY_MACHINE_VERSION`. */
  readonly machineVersion?: string;
  /** `FLY_VM_MEMORY_MB`, as a number. */
  readonly memoryMb?: number;
};

/** Options for `flyServer()` and `flyExtend()`. */
export type FlyServerOptions<
  K extends keyof FlyServerInfo = keyof FlyServerInfo,
> = ServerEnvOptions<FlyServerInfo, K>;

/** Read Fly.io metadata from the environment; `undefined` off Fly. */
export function flyServer<K extends keyof FlyServerInfo = never>(
  options?: FlyServerOptions<K>,
): Omit<FlyServerInfo, K> | undefined {
  const env = options?.env;
  const instanceId = readEnvText("FLY_MACHINE_ID", env) ??
    readEnvText("FLY_ALLOC_ID", env);
  const service = readEnvText("FLY_APP_NAME", env);
  if (instanceId == null && service == null) return undefined;

  const region = readEnvText("FLY_REGION", env);
  const version = readEnvText("FLY_IMAGE_REF", env);
  const primaryRegion = readEnvText("PRIMARY_REGION", env);
  const processGroup = readEnvText("FLY_PROCESS_GROUP", env);
  const machineVersion = readEnvText("FLY_MACHINE_VERSION", env);
  const memoryMb = readEnvCount("FLY_VM_MEMORY_MB", env);

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

/** An `extend` hook that renders `{ server }` on Fly.io and `{}` elsewhere, computed once. */
export function flyExtend<K extends keyof FlyServerInfo = never>(
  options?: FlyServerOptions<K>,
): () => JsonObject {
  return serverExtend(() => flyServer(options));
}
