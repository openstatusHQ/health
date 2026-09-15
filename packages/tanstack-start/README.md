# @openstatus/health-tanstack-start

TanStack Start server-route adapter for
[`@openstatus/health`](https://jsr.io/@openstatus/health).

```sh
npm install @openstatus/health @openstatus/health-tanstack-start
```

```ts
// src/routes/api/health.ts
import { createFileRoute } from "@tanstack/react-router";
import { healthRoute } from "@openstatus/health-tanstack-start";
import { drizzleProbe } from "@openstatus/health-drizzle";
import { db } from "../../lib/db";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: healthRoute({
      probes: [drizzleProbe({ db })],
      extend: (_report, { request }) => ({
        requestId: request.headers.get("x-request-id"),
      }),
    }),
  },
});
```

`healthRoute()` returns `{ GET, HEAD }` for `server.handlers`. Use
`healthHandler()` when a method needs its own middleware through
`createHandlers`:

```ts
export const Route = createFileRoute("/api/health")({
  server: {
    middleware: [authMiddleware],
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: { middleware: [logMiddleware], handler: healthHandler(options) },
        HEAD: healthHandler(options),
      }),
  },
});
```

The route path is the file location, so there is no `path` option. The
`createFileRoute(name)` above comes from TanStack Start's generated route tree;
without the router plugin (or its codegen), use
`createRoute({ getParentRoute, path, server })` as the package tests do.
`extend`, a function-form `exposeChecks` and `onError` receive the handler
context `{ request, params, context }`. Pass the middleware context type to
read it with full typing:

```ts
healthRoute<{ requestId: string }>({
  probes,
  extend: (_report, { context }) => ({ requestId: context.requestId }),
});
```

Pass `check` instead of `probes` to share one `createHealthCheck()` with
another route. The package has no runtime imports and no TanStack peer
dependency, so it works with `@tanstack/react-router` and
`@tanstack/solid-router` alike and on every Start deployment target.

## About openstatus

[openstatus](https://www.openstatus.dev/) is the open-source uptime monitoring
and status page platform. This package is part of
[`@openstatus/health`](https://github.com/openstatusHQ/health), the `/health`
endpoints behind openstatus's own services, extracted so any JavaScript server
can expose one. Point an
[openstatus monitor](https://www.openstatus.dev/docs/reference/http-monitor)
at the endpoint and assert on `status` in the body to be alerted on
`degraded` before it becomes `unhealthy`.

Source: [github.com/openstatusHQ/health](https://github.com/openstatusHQ/health).
Issues and PRs welcome.

## License

[MIT](https://github.com/openstatusHQ/health/blob/main/LICENSE)
