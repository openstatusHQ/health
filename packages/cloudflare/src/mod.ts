/**
 * Cloudflare Workers server metadata for `@openstatus/health`: renders the
 * colo that served the request, and the Worker version when you supply the
 * binding, under a `server` key.
 *
 * ```ts
 * import { createLazyHealthHandler } from "@openstatus/health";
 * import { cloudflareExtend } from "@openstatus/health-cloudflare";
 *
 * export default {
 *   fetch: createLazyHealthHandler<Request, Env>((env) => ({
 *     probes: [],
 *     extend: cloudflareExtend({ version: env.CF_VERSION_METADATA }),
 *   })),
 * };
 * ```
 *
 * @module
 */

import type { HealthReport, JsonObject } from "@openstatus/health";
import { omitFields } from "@openstatus/health";

/** A `Request` carrying Cloudflare's `cf` properties. */
export type CloudflareRequestLike = Request & {
  /** Set by the Workers runtime; `colo` is the serving data centre. */
  readonly cf?: { readonly colo?: string };
};

/** The shape of a `version_metadata` binding. */
export type CloudflareVersionMetadata = {
  /** The Worker version id. */
  readonly id?: string;
  /** The Worker version tag. */
  readonly tag?: string;
};

/** The `server` object rendered on Cloudflare; unavailable fields are absent. */
export type CloudflareServerInfo = {
  /** Always `"cloudflare"`. */
  readonly platform: "cloudflare";
  /** `request.cf.colo`, the IATA code of the serving data centre. */
  readonly region?: string;
  /** `CF_VERSION_METADATA.id`, when the binding is passed. */
  readonly version?: string;
  /** `CF_VERSION_METADATA.tag`, when the binding is passed. */
  readonly versionTag?: string;
};

/** Options for `cloudflareServer()`. */
export type CloudflareServerOptions = {
  /** The `version_metadata` binding. */
  readonly version?: CloudflareVersionMetadata;
  /** Fields to leave out of the rendered object. */
  readonly omit?: readonly (keyof CloudflareServerInfo)[];
};

/** Options for `cloudflareExtend()`. */
export type CloudflareExtendOptions<Ctx> = CloudflareServerOptions & {
  /** Pick the `Request` out of the framework context when it is not the context itself. */
  readonly request?: (ctx: Ctx) => CloudflareRequestLike;
};

function text(value: string | undefined): string | undefined {
  return value == null || value === "" ? undefined : value;
}

/** Read Cloudflare metadata from a request; `undefined` when `request.cf` is missing. */
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

/** An `extend` hook that renders `{ server }` per request on Cloudflare and `{}` elsewhere. */
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
