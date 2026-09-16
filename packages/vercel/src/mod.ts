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

import type { JsonObject } from "@openstatus/health";
import { omitFields, readEnv } from "@openstatus/health";

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
export type VercelServerOptions = {
  /** Environment to read instead of the process environment; for tests. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Fields to leave out of the rendered object. */
  readonly omit?: readonly (keyof VercelServerInfo)[];
};

function text(value: string | undefined): string | undefined {
  return value == null || value === "" ? undefined : value;
}

/** Read Vercel metadata from the environment; `undefined` off Vercel. */
export function vercelServer(
  options?: VercelServerOptions,
): VercelServerInfo | undefined {
  const env = options?.env;
  if (text(readEnv("VERCEL", env)) == null) return undefined;

  const region = text(readEnv("VERCEL_REGION", env));
  const environment = text(readEnv("VERCEL_ENV", env));
  const version = text(readEnv("VERCEL_DEPLOYMENT_ID", env));
  const projectId = text(readEnv("VERCEL_PROJECT_ID", env));
  const targetEnvironment = text(readEnv("VERCEL_TARGET_ENV", env));
  const commitSha = text(readEnv("VERCEL_GIT_COMMIT_SHA", env));
  const branch = text(readEnv("VERCEL_GIT_COMMIT_REF", env));

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
export function vercelExtend(options?: VercelServerOptions): () => JsonObject {
  let cached: JsonObject | undefined;
  return (): JsonObject => {
    if (cached == null) {
      const server = vercelServer(options);
      cached = server == null ? {} : { server };
    }
    return cached;
  };
}
