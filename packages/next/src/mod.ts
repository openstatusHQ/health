/**
 * Next.js App Router adapter for `@openstatus/health`. The route file is the
 * path; `healthRoute()` gives it `GET` and `HEAD`.
 *
 * ```ts
 * // app/health/route.ts
 * import { healthRoute } from "@openstatus/health-next";
 *
 * export const { GET, HEAD } = healthRoute({ probes: [] });
 * ```
 *
 * @module
 */

import type { NextRequest } from "next/server";
import {
  createHealthHandler,
  type HealthHandler,
  type HealthHandlerOptions,
} from "@openstatus/health";

/** Options for `healthRoute()`; `extend` and `exposeChecks` receive the `NextRequest`. */
export type NextHealthOptions = HealthHandlerOptions<NextRequest>;

/** The route handlers to export from a `route.ts` file. */
export interface NextHealthRoute {
  /** Answers with the JSON body. */
  readonly GET: HealthHandler<NextRequest>;
  /** Answers with the status code only. */
  readonly HEAD: HealthHandler<NextRequest>;
}

/** Build the `GET` and `HEAD` handlers for a `route.ts` file. */
export function healthRoute(options: NextHealthOptions): NextHealthRoute {
  const handler = createHealthHandler<NextRequest>(options);
  return { GET: handler, HEAD: handler };
}
