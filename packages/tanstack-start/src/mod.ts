import {
  createHealthResponder,
  type HealthHandlerOptions,
} from "@openstatus/health";

export type LooseContext = object | undefined;

export interface StartHandlerContext<TContext = LooseContext> {
  readonly request: Request;
  readonly params: Readonly<Record<string, string>>;
  readonly context: TContext;
}

export type StartHealthOptions<TContext = LooseContext> = HealthHandlerOptions<
  StartHandlerContext<TContext>
>;

export type StartHealthHandler<TContext = LooseContext> = (
  ctx: StartHandlerContext<TContext>,
) => Promise<Response>;

export interface StartHealthRoute<TContext = LooseContext> {
  readonly GET: StartHealthHandler<TContext>;
  readonly HEAD: StartHealthHandler<TContext>;
}

export function healthHandler<TContext = LooseContext>(
  options: StartHealthOptions<TContext>,
): StartHealthHandler<TContext> {
  const responder = createHealthResponder<StartHandlerContext<TContext>>(
    options,
  );
  return (ctx: StartHandlerContext<TContext>): Promise<Response> =>
    responder.toResponse(ctx, ctx.request.method);
}

export function healthRoute<TContext = LooseContext>(
  options: StartHealthOptions<TContext>,
): StartHealthRoute<TContext> {
  const handler = healthHandler<TContext>(options);
  return { GET: handler, HEAD: handler };
}
