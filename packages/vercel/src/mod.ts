/**
 * Vercel server metadata for `@openstatus/health`: renders the region,
 * environment and deployment that produced the response under a `server` key.
 *
 * ```ts
 * import { vercelExtend } from "@openstatus/health-vercel";
 *
 * healthRoute({ probes: [], extend: vercelExtend() });
 * ```
 *
 * @module
 */

import type { JsonObject, ServerEnvOptions } from "@openstatus/health";
import { omitFields, readEnvText, serverExtend } from "@openstatus/health";

/** The `server` object rendered on Vercel; fields Vercel does not set are absent. */
export type VercelServerInfo = {
  /** Always `"vercel"`. */
  readonly platform: "vercel";
  /** `VERCEL_REGION`. */
  readonly region?: string;
  /** `VERCEL_ENV`. */
  readonly environment?: string;
  /** `VERCEL_DEPLOYMENT_ID`. */
  readonly version?: string;
  /** `VERCEL_PROJECT_ID`. */
  readonly projectId?: string;
  /** `VERCEL_TARGET_ENV`. */
  readonly targetEnvironment?: string;
  /** `VERCEL_GIT_COMMIT_SHA`. */
  readonly commitSha?: string;
  /** `VERCEL_GIT_COMMIT_REF`. */
  readonly branch?: string;
};

/** Options for `vercelServer()` and `vercelExtend()`. */
export type VercelServerOptions<
  K extends keyof VercelServerInfo = keyof VercelServerInfo,
> = ServerEnvOptions<VercelServerInfo, K>;

/** Read Vercel metadata from the environment; `undefined` off Vercel. */
export function vercelServer<K extends keyof VercelServerInfo = never>(
  options?: VercelServerOptions<K>,
): Omit<VercelServerInfo, K> | undefined {
  const env = options?.env;
  if (readEnvText("VERCEL", env) == null) return undefined;

  const region = readEnvText("VERCEL_REGION", env);
  const environment = readEnvText("VERCEL_ENV", env);
  const version = readEnvText("VERCEL_DEPLOYMENT_ID", env);
  const projectId = readEnvText("VERCEL_PROJECT_ID", env);
  const targetEnvironment = readEnvText("VERCEL_TARGET_ENV", env);
  const commitSha = readEnvText("VERCEL_GIT_COMMIT_SHA", env);
  const branch = readEnvText("VERCEL_GIT_COMMIT_REF", env);

  const info: VercelServerInfo = {
    platform: "vercel",
    ...(region != null ? { region } : {}),
    ...(environment != null ? { environment } : {}),
    ...(version != null ? { version } : {}),
    ...(projectId != null ? { projectId } : {}),
    ...(targetEnvironment != null ? { targetEnvironment } : {}),
    ...(commitSha != null ? { commitSha } : {}),
    ...(branch != null ? { branch } : {}),
  };
  return omitFields(info, options?.omit);
}

/** An `extend` hook that renders `{ server }` on Vercel and `{}` elsewhere, computed once. */
export function vercelExtend<K extends keyof VercelServerInfo = never>(
  options?: VercelServerOptions<K>,
): () => JsonObject {
  return serverExtend(() => vercelServer(options));
}
