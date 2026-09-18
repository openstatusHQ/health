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

import type { JsonObject, ServerEnvOptions } from "@openstatus/health";
import {
  omitFields,
  readEnvCount,
  readEnvText,
  serverExtend,
} from "@openstatus/health";

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
export type KoyebServerOptions<
  K extends keyof KoyebServerInfo = keyof KoyebServerInfo,
> = ServerEnvOptions<KoyebServerInfo, K>;

/** Read Koyeb metadata from the environment; `undefined` off Koyeb. */
export function koyebServer<K extends keyof KoyebServerInfo = never>(
  options?: KoyebServerOptions<K>,
): Omit<KoyebServerInfo, K> | undefined {
  const env = options?.env;
  const instanceId = readEnvText("KOYEB_INSTANCE_ID", env);
  if (instanceId == null) return undefined;

  const region = readEnvText("KOYEB_REGION", env);
  const service = readEnvText("KOYEB_SERVICE_NAME", env);
  const version = readEnvText("KOYEB_REGIONAL_DEPLOYMENT_ID", env);
  const app = readEnvText("KOYEB_APP_NAME", env);
  const datacenter = readEnvText("KOYEB_DC", env);
  const replicaIndex = readEnvCount("KOYEB_REPLICA_INDEX", env);
  const instanceType = readEnvText("KOYEB_INSTANCE_TYPE", env);

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
export function koyebExtend<K extends keyof KoyebServerInfo = never>(
  options?: KoyebServerOptions<K>,
): () => JsonObject {
  return serverExtend(() => koyebServer(options));
}
