/**
 * Elysia adapter for `@openstatus/health`: `healthRoute()` returns a plugin to
 * `.use()`, `healthHandler()` a bare handler.
 *
 * ```ts
 * import { Elysia } from "elysia";
 * import { healthRoute } from "@openstatus/health-elysia";
 *
 * const app = new Elysia().use(healthRoute({ probes: [] }));
 * ```
 *
 * @module
 */

import type { Context, RouteSchema, SingletonBase } from "elysia";
import { Elysia } from "elysia";
import {
  createHealthResponder,
  type HealthHandlerOptions,
  type HealthRouteOptions,
} from "@openstatus/health";

/** The Elysia singleton used when none is given, so untyped usage compiles. */
export type ElysiaBlankSingleton = {
  /** No decorators. */
  decorator: Record<never, never>;
  /** No store. */
  store: Record<never, never>;
  /** No derived values. */
  derive: Record<never, never>;
  /** No resolved values. */
  resolve: Record<never, never>;
};

/** The Elysia `Context` passed to `extend` and `exposeChecks`. */
export type ElysiaHealthContext<
  S extends SingletonBase = ElysiaBlankSingleton,
> = Context<RouteSchema, S>;

/** Options for `healthRoute()`. */
export type ElysiaHealthOptions = HealthRouteOptions<ElysiaHealthContext>;

/** Options for `healthHandler()`. */
export type ElysiaHealthHandlerOptions<
  S extends SingletonBase = ElysiaBlankSingleton,
> = HealthHandlerOptions<ElysiaHealthContext<S>>;

/** The handler returned by `healthHandler()`. */
export type ElysiaHealthHandler<
  S extends SingletonBase = ElysiaBlankSingleton,
> = (ctx: ElysiaHealthContext<S>) => Promise<Response>;

/** Route mounted by `healthRoute()` when `path` is unset. */
export const defaultPath = "/health";

/** An Elysia handler that answers the health endpoint on whatever route you attach it to. */
export function healthHandler<S extends SingletonBase = ElysiaBlankSingleton>(
  options: ElysiaHealthHandlerOptions<S>,
): ElysiaHealthHandler<S> {
  const responder = createHealthResponder<ElysiaHealthContext<S>>(options);
  return (ctx: ElysiaHealthContext<S>): Promise<Response> =>
    responder.toResponse(ctx, ctx.request.method);
}

/** An Elysia plugin serving `GET` and `HEAD` on `path`. */
export function healthRoute(options: ElysiaHealthOptions): Elysia {
  const handler = healthHandler(options);
  const path = options.path ?? defaultPath;
  return new Elysia({ name: "@openstatus/health", seed: path })
    .get(path, handler)
    .head(path, handler);
}
