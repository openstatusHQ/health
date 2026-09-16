/**
 * Koyeb server metadata for `@openstatus/health`: renders the region,
 * instance and deployment that produced the response under a `server` key.
 *
 * ```ts
 * import { koyebExtend } from "@openstatus/health-koyeb";
 *
 * healthRoute({ probes: [], extend: koyebExtend() });
 * ```
 *
 * @module
 */

import type { JsonObject } from "@openstatus/health";
import { omitFields, readEnv } from "@openstatus/health";

/** The `server` object rendered on Koyeb; fields Koyeb does not set are absent. */
export type KoyebServerInfo = {
  /** Always `"koyeb"`. */
  readonly platform: "koyeb";
  /** `KOYEB_REGION`. */
  readonly region?: string;
  /** `KOYEB_INSTANCE_ID`. */
  readonly instanceId?: string;
  /** `KOYEB_SERVICE_NAME`. */
  readonly service?: string;
  /** `KOYEB_REGIONAL_DEPLOYMENT_ID`. */
  readonly version?: string;
  /** `KOYEB_APP_NAME`. */
  readonly app?: string;
  /** `KOYEB_DC`. */
  readonly datacenter?: string;
  /** `KOYEB_REPLICA_INDEX`, as a number. */
  readonly replicaIndex?: number;
  /** `KOYEB_INSTANCE_TYPE`. */
  readonly instanceType?: string;
};

/** Options for `koyebServer()` and `koyebExtend()`. */
export type KoyebServerOptions = {
  /** Environment to read instead of the process environment; for tests. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Fields to leave out of the rendered object. */
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

/** Read Koyeb metadata from the environment; `undefined` off Koyeb. */
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

/** An `extend` hook that renders `{ server }` on Koyeb and `{}` elsewhere, computed once. */
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
