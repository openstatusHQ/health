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

import type { JsonObject } from "@openstatus/health";
import { omitFields, readEnv } from "@openstatus/health";

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
export type FlyServerOptions = {
  /** Environment to read instead of the process environment; for tests. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Fields to leave out of the rendered object. */
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

/** Read Fly.io metadata from the environment; `undefined` off Fly. */
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

/** An `extend` hook that renders `{ server }` on Fly.io and `{}` elsewhere, computed once. */
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
