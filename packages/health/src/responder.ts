/**
 * The framework-agnostic responder every adapter is built on.
 *
 * @module
 */

import { createHealthCheck } from "./check.ts";
import { toError } from "./errors.ts";
import { renderHealthResponse } from "./response.ts";
import type {
  HealthCheck,
  HealthHandlerOptions,
  HealthHttpResponse,
  HealthReport,
  HealthResponder,
  HealthResponseBody,
  HealthSource,
} from "./types.ts";

/** The `check` you passed, or one built from `probes`. */
export function resolveHealthCheck(source: HealthSource): HealthCheck {
  if (source.check != null) return source.check;
  return createHealthCheck(source);
}

/**
 * Build a `HealthResponder` for a framework whose request context is `Ctx`.
 * `respond` renders `{ status, headers, body }`; `toResponse` builds a Fetch
 * `Response` and drops the body on `HEAD`. Errors from `extend` and
 * `exposeChecks` go to `onError` and never fail the request.
 */
export function createHealthResponder<Ctx = Request>(
  options: HealthHandlerOptions<Ctx>,
): HealthResponder<Ctx> {
  const check = resolveHealthCheck(options);
  const fail = (error: Error, ctx: Ctx): void => {
    if (options.onError == null) {
      console.error("[@openstatus/health]", error);
      return;
    }
    try {
      options.onError(error, ctx);
    } catch {
      return;
    }
  };

  const exposed = async (ctx: Ctx): Promise<boolean> => {
    const option = options.exposeChecks ?? true;
    if (typeof option === "boolean") return option;
    try {
      return await option(ctx);
    } catch (e) {
      fail(toError(e), ctx);
      return false;
    }
  };

  const extended = async (report: HealthReport, ctx: Ctx): Promise<object> => {
    if (options.extend == null) return {};
    try {
      return await options.extend(report, ctx);
    } catch (e) {
      fail(toError(e), ctx);
      return {};
    }
  };

  const respond = async (ctx: Ctx): Promise<HealthHttpResponse> => {
    const [current, exposeChecks] = await Promise.all([
      check.report(),
      exposed(ctx),
    ]);
    return renderHealthResponse(
      current,
      {
        exposeChecks,
        unhealthyStatusCode: options.unhealthyStatusCode,
        degradedStatusCode: options.degradedStatusCode,
      },
      exposeChecks ? await extended(current, ctx) : {},
    );
  };

  return {
    check,
    respond,
    async toResponse(ctx: Ctx, method = "GET"): Promise<Response> {
      const rendered = await respond(ctx);
      let payload: string | null = null;
      if (method !== "HEAD") {
        try {
          payload = JSON.stringify(rendered.body);
        } catch (e) {
          fail(toError(e), ctx);
          payload = fallbackBody(rendered.body);
        }
      }
      return new Response(payload, {
        status: rendered.status,
        headers: rendered.headers,
      });
    },
  };
}

function fallbackBody(body: HealthResponseBody): string {
  return JSON.stringify({
    status: body.status,
    checkedAt: body.checkedAt,
    ...(body.checks !== undefined ? { checks: body.checks } : {}),
    ...(body.latencyMs !== undefined ? { latencyMs: body.latencyMs } : {}),
  });
}
