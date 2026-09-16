/**
 * Fetch-API handlers for runtimes that speak `(Request) => Response`.
 *
 * @module
 */

import { createHealthResponder } from "./responder.ts";
import { healthHeaders } from "./response.ts";
import type { HealthRouteOptions } from "./types.ts";

/** A `(request) => Response` handler from `createHealthHandler()`. */
export type HealthHandler<Req extends Request = Request> = (
  request: Req,
) => Promise<Response>;

/** A `(request, env) => Response` handler from `createLazyHealthHandler()`. */
export type LazyHealthHandler<Req extends Request = Request, Env = never> = (
  request: Req,
  env: Env,
) => Promise<Response>;

/**
 * Build a Fetch-API handler. Answers `GET` and `HEAD`, `405` otherwise; with
 * `path` set, any other URL gets `404`, a trailing slash tolerated.
 */
export function createHealthHandler<Req extends Request = Request>(
  options: HealthRouteOptions<Req>,
): HealthHandler<Req> {
  const responder = createHealthResponder<Req>(options);
  const path = options.path;
  return (request: Req): Promise<Response> => {
    if (path != null && !matchesPath(request.url, path)) {
      return Promise.resolve(
        new Response(null, { status: 404, headers: healthHeaders }),
      );
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return Promise.resolve(
        new Response(null, {
          status: 405,
          headers: { ...healthHeaders, allow: "GET, HEAD" },
        }),
      );
    }
    return responder.toResponse(request, request.method);
  };
}

/**
 * The same as `createHealthHandler()`, but `build` runs on the first request
 * and the handler it returns is reused. For runtimes where configuration only
 * exists per request, such as Cloudflare Workers' `fetch(request, env)`.
 */
export function createLazyHealthHandler<
  Req extends Request = Request,
  Env = never,
>(
  build: (env: Env, request: Req) => HealthRouteOptions<Req>,
): LazyHealthHandler<Req, Env> {
  let handler: HealthHandler<Req> | undefined;
  return (request: Req, env: Env): Promise<Response> => {
    handler ??= createHealthHandler(build(env, request));
    return handler(request);
  };
}

function matchesPath(url: string, path: string): boolean {
  const pathname = new URL(url).pathname;
  return trimSlash(pathname) === trimSlash(path);
}

function trimSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}
