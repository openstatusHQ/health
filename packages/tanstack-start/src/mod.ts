/**
 * TanStack Start adapter for `@openstatus/health`. The route file is the
 * path; `healthRoute()` returns `{ GET, HEAD }` for `server.handlers`.
 *
 * ```ts
 * import { createFileRoute } from "@tanstack/react-router";
 * import { healthRoute } from "@openstatus/health-tanstack-start";
 *
 * export const Route = createFileRoute("/health")({
 *   server: { handlers: healthRoute({ probes: [] }) },
 * });
 * ```
 *
 * @module
 */

import {
  createHealthResponder,
  type HealthHandlerOptions,
} from "@openstatus/health";

/** The route context used when none is given, so untyped usage compiles. */
export type LooseContext = object | undefined;

/** What TanStack Start passes to a server route handler. */
export interface StartHandlerContext<TContext = LooseContext> {
  /** The incoming request. */
  readonly request: Request;
  /** Path parameters. */
  readonly params: Readonly<Record<string, string>>;
  /** The route context. */
  readonly context: TContext;
}

/** Options for `healthRoute()` and `healthHandler()`; `extend` and `exposeChecks` receive the handler context. */
export type StartHealthOptions<TContext = LooseContext> = HealthHandlerOptions<
  StartHandlerContext<TContext>
>;

/** The handler returned by `healthHandler()`. */
export type StartHealthHandler<TContext = LooseContext> = (
  ctx: StartHandlerContext<TContext>,
) => Promise<Response>;

/** The handlers to pass as `server.handlers`. */
export interface StartHealthRoute<TContext = LooseContext> {
  /** Answers with the JSON body. */
  readonly GET: StartHealthHandler<TContext>;
  /** Answers with the status code only. */
  readonly HEAD: StartHealthHandler<TContext>;
}

/** A bare server route handler for the health endpoint. */
export function healthHandler<TContext = LooseContext>(
  options: StartHealthOptions<TContext>,
): StartHealthHandler<TContext> {
  const responder = createHealthResponder<StartHandlerContext<TContext>>(
    options,
  );
  return (ctx: StartHandlerContext<TContext>): Promise<Response> =>
    responder.toResponse(ctx, ctx.request.method);
}

/** Build the `GET` and `HEAD` handlers for `server.handlers`. */
export function healthRoute<TContext = LooseContext>(
  options: StartHealthOptions<TContext>,
): StartHealthRoute<TContext> {
  const handler = healthHandler<TContext>(options);
  return { GET: handler, HEAD: handler };
}
