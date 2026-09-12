# @openstatus/health-express

Express adapter for [`@openstatus/health`](https://jsr.io/@openstatus/health).
Works with Express 4 and 5.

```sh
npm install @openstatus/health @openstatus/health-express
```

```ts
import express from "express";
import { healthRoute } from "@openstatus/health-express";
import { unkeyProbe } from "@openstatus/health-unkey";

const app = express();
app.use(healthRoute({ probes: [unkeyProbe()] }));
```

`healthRoute(options)` returns an `express.Router` answering `GET` and `HEAD`
on `options.path` (default `/health`). `healthHandler(options)` is the
`RequestHandler` underneath, for a route of your own:

```ts
import { healthHandler } from "@openstatus/health-express";

app.get("/health", requireInternalNetwork, healthHandler({ probes }));
```

`extend` and a function-form `exposeChecks` receive the full Express
`Request` — `req.ip`, `req.query`, `req.get()` and anything middleware
attached. Pass the shape of `res.locals` as a type argument to have
`req.res.locals` typed:

```ts
app.get("/health", healthHandler<{ user: User }>({
  probes,
  exposeChecks: (req) => req.res?.locals.user.role === "ops",
}));
```

Pass `check` instead of `probes` to share one `createHealthCheck()` between
routes. Probe failures never reject the request; an `extend` that throws is
reported to `onError` and the report is served without it. Methods other than
`GET` and `HEAD` fall through to Express's default `404`.

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
