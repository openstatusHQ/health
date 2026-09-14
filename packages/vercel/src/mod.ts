import type { JsonObject } from "@openstatus/health";
import { omitFields, readEnv } from "@openstatus/health";

export type VercelServerInfo = {
  readonly platform: "vercel";
  readonly region?: string;
  readonly environment?: string;
  readonly version?: string;
  readonly projectId?: string;
  readonly targetEnvironment?: string;
  readonly commitSha?: string;
  readonly branch?: string;
};

export type VercelServerOptions = {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly omit?: readonly (keyof VercelServerInfo)[];
};

function text(value: string | undefined): string | undefined {
  return value == null || value === "" ? undefined : value;
}

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
