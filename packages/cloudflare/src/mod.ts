import type { HealthReport, JsonObject } from "@openstatus/health";
import { omitFields } from "@openstatus/health";

export type CloudflareRequestLike = Request & {
  readonly cf?: { readonly colo?: string };
};

export type CloudflareVersionMetadata = {
  readonly id?: string;
  readonly tag?: string;
};

export type CloudflareServerInfo = {
  readonly platform: "cloudflare";
  readonly region?: string;
  readonly version?: string;
  readonly versionTag?: string;
};

export type CloudflareServerOptions = {
  readonly version?: CloudflareVersionMetadata;
  readonly omit?: readonly (keyof CloudflareServerInfo)[];
};

export type CloudflareExtendOptions<Ctx> = CloudflareServerOptions & {
  readonly request?: (ctx: Ctx) => CloudflareRequestLike;
};

function text(value: string | undefined): string | undefined {
  return value == null || value === "" ? undefined : value;
}

export function cloudflareServer(
  request: CloudflareRequestLike,
  options?: CloudflareServerOptions,
): CloudflareServerInfo | undefined {
  if (request?.cf == null) return undefined;

  const region = text(request.cf.colo);
  const version = text(options?.version?.id);
  const versionTag = text(options?.version?.tag);

  const info: CloudflareServerInfo = {
    platform: "cloudflare",
    ...(region != null ? { region } : {}),
    ...(version != null ? { version } : {}),
    ...(versionTag != null ? { versionTag } : {}),
  };
  return omitFields(info, options?.omit);
}

export function cloudflareExtend<Ctx = Request>(
  options?: CloudflareExtendOptions<Ctx>,
): (report: HealthReport, ctx: Ctx) => JsonObject {
  const pick = options?.request;
  return (_report: HealthReport, ctx: Ctx): JsonObject => {
    const request = pick == null ? (ctx as CloudflareRequestLike) : pick(ctx);
    const server = cloudflareServer(request, options);
    return server == null ? {} : { server };
  };
}
