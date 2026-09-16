/**
 * Express adapter for `@openstatus/health`: `healthRoute()` returns a `Router`
 * to `app.use()`, `healthHandler()` a bare `RequestHandler`.
 *
 * ```ts
 * import express from "express";
 * import { healthRoute } from "@openstatus/health-express";
 *
 * const app = express();
 * app.use(healthRoute({ probes: [] }));
 * ```
 *
 * @module
 */

import express from "express";
import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from "express";
import {
  createHealthResponder,
  type HealthHandlerOptions,
  type HealthRouteOptions,
} from "@openstatus/health";

type Params = Request["params"];
type Query = Request["query"];

/** The `res.locals` shape used when none is given, so untyped usage compiles. */
export type ExpressLocals = Record<string, unknown>;

/** The Express `Request` passed to `extend` and `exposeChecks`. */
export type ExpressHealthRequest<L extends ExpressLocals = ExpressLocals> =
  Request<Params, unknown, unknown, Query, L>;

/** The Express `Response` the handler writes to. */
export type ExpressHealthResponse<L extends ExpressLocals = ExpressLocals> =
  Response<unknown, L>;

/** The handler returned by `healthHandler()`. */
export type ExpressHealthHandler<L extends ExpressLocals = ExpressLocals> =
  RequestHandler<Params, unknown, unknown, Query, L>;

/** Options for `healthRoute()`. */
export type ExpressHealthOptions<L extends ExpressLocals = ExpressLocals> =
  HealthRouteOptions<ExpressHealthRequest<L>>;

/** Options for `healthHandler()`. */
export type ExpressHealthHandlerOptions<
  L extends ExpressLocals = ExpressLocals,
> = HealthHandlerOptions<ExpressHealthRequest<L>>;

/** Route mounted by `healthRoute()` when `path` is unset. */
export const defaultPath = "/health";

/** An Express `RequestHandler` that answers the health endpoint; errors go to `next`. */
export function healthHandler<L extends ExpressLocals = ExpressLocals>(
  options: ExpressHealthHandlerOptions<L>,
): ExpressHealthHandler<L> {
  const responder = createHealthResponder<ExpressHealthRequest<L>>(options);
  const respond = async (
    req: ExpressHealthRequest<L>,
    res: ExpressHealthResponse<L>,
  ): Promise<void> => {
    const rendered = await responder.respond(req);
    res.status(rendered.status).set({ ...rendered.headers });
    if (req.method === "HEAD") res.end();
    else res.send(JSON.stringify(rendered.body));
  };
  return (
    req: ExpressHealthRequest<L>,
    res: ExpressHealthResponse<L>,
    next: NextFunction,
  ): void => {
    respond(req, res).catch(next);
  };
}

/** An Express `Router` serving `GET` and `HEAD` on `path`. */
export function healthRoute<L extends ExpressLocals = ExpressLocals>(
  options: ExpressHealthOptions<L>,
): Router {
  const handler = healthHandler<L>(options);
  const path = options.path ?? defaultPath;
  const router = express.Router();
  router.get(path, handler);
  router.head(path, handler);
  return router;
}
