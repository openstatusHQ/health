/**
 * Hono adapter for `@openstatus/health`: `healthRoute()` returns a sub-app to
 * mount with `app.route()`, `healthHandler()` a bare `Handler`.
 *
 * ```ts
 * import { Hono } from "hono";
 * import { healthRoute } from "@openstatus/health-hono";
 *
 * const app = new Hono();
 * app.route("/", healthRoute({ probes: [] }));
 * ```
 *
 * @module
 */

import type { Context, Env, Handler } from "hono";
import { Hono } from "hono";
import {
  createHealthResponder,
  type HealthHandlerOptions,
  type HealthRouteOptions,
} from "@openstatus/health";

/** The Hono `Env` used when none is given, so untyped usage compiles. */
export type LooseEnv = {
  /** Untyped bindings. */
  readonly Bindings: Record<string, unknown>;
  /** Untyped variables. */
  readonly Variables: Record<string, unknown>;
};

/** Options for `healthRoute()`; `extend` and `exposeChecks` receive the Hono `Context`. */
export type HonoHealthOptions<E extends Env = LooseEnv> = HealthRouteOptions<
  Context<E>
>;

/** Options for `healthHandler()`; `extend` and `exposeChecks` receive the Hono `Context`. */
export type HonoHealthHandlerOptions<E extends Env = LooseEnv> =
  HealthHandlerOptions<Context<E>>;

/** Route mounted by `healthRoute()` when `path` is unset. */
export const defaultPath = "/health";

/** A Hono `Handler` that answers the health endpoint on whatever route you attach it to. */
export function healthHandler<E extends Env = LooseEnv>(
  options: HonoHealthHandlerOptions<E>,
): Handler<E> {
  const responder = createHealthResponder<Context<E>>(options);
  return (c: Context<E>): Promise<Response> =>
    responder.toResponse(c, c.req.method);
}

/** A Hono sub-app serving `GET` and `HEAD` on `path`, trailing slash tolerated. */
export function healthRoute<E extends Env = LooseEnv>(
  options: HonoHealthOptions<E>,
): Hono<E> {
  const handler = healthHandler<E>(options);
  const path = options.path ?? defaultPath;
  const app = new Hono<E>({ strict: false });
  for (const p of routePaths(path)) {
    app.on(["GET", "HEAD"], p, handler);
  }
  return app;
}

function routePaths(path: string): string[] {
  if (path === "/" || path.endsWith("/")) return [path];
  return [path, `${path}/`];
}
