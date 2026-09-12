# @openstatus/health-hono

Hono adapter for [`@openstatus/health`](https://jsr.io/@openstatus/health).

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-hono
npm install @openstatus/health @openstatus/health-hono
```

```ts
import { Hono } from "hono";
import { healthRoute } from "@openstatus/health-hono";
import { tursoProbe } from "@openstatus/health-turso";
import { unkeyProbe } from "@openstatus/health-unkey";

const app = new Hono();

app.route(
  "/",
  healthRoute({
    probes: [tursoProbe({ client }), unkeyProbe()],
    extend: (_report, c) => ({ requestId: c.get("requestId") }),
  }),
);
```

`healthRoute(options)` returns a `Hono` sub-app that answers `GET` and `HEAD`
on `options.path` (default `/health`). Both `/health` and `/health/` are
registered, so the trailing slash matches regardless of the parent app's
`strict` setting. Mount it with `app.route("/", ...)` — the path is already
inside the sub-app, so `app.route("/health", ...)` would serve
`/health/health`.

When you would rather own the route, `healthHandler(options)` returns a plain
Hono `Handler` that answers both methods and takes every option except `path`:

```ts
import { healthHandler } from "@openstatus/health-hono";

app.on(["GET", "HEAD"], "/health", auth, healthHandler({ probes }));
```

`extend` and a function-form `exposeChecks` receive the Hono `Context`.
Without a type argument the context is loosely typed — `c.get(key)` and
`c.env` are `unknown`. Pass your app's `Env` to get the same types as your
routes, typos included:

```ts
type Env = { Variables: { requestId: string }; Bindings: { HEALTH_TOKEN: string } };
const app = new Hono<Env>();

app.route("/", healthRoute<Env>({
  probes,
  exposeChecks: (c) => c.req.header("x-health-token") === c.env.HEALTH_TOKEN,
  extend: (_report, c) => ({ requestId: c.get("requestId") }),
}));
```

Pass `check` instead of `probes` to share one `createHealthCheck()` between
routes. Methods other than `GET` and `HEAD` are not registered and fall
through to your app's `notFound`. All other options are documented in
`@openstatus/health`.

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
