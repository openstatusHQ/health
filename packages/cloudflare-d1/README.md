# @openstatus/health-cloudflare-d1

[Cloudflare D1](https://developers.cloudflare.com/d1/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Runs `select 1`
through the `D1Database` binding of a Worker and fails the check when the
statement does.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-cloudflare-d1
npm install @openstatus/health @openstatus/health-cloudflare-d1
```

```ts
import { createLazyHealthHandler } from "@openstatus/health";
import { d1Probe } from "@openstatus/health-cloudflare-d1";

interface Env {
  DB: D1Database;
}

export default {
  fetch: createLazyHealthHandler<Request, Env>((env) => ({
    path: "/health",
    probes: [d1Probe({ db: env.DB })],
  })),
};
```

Bindings only exist inside `fetch(request, env)` in Workers, but the handler
must be built once or every request gets a fresh cache and the probe runs on
every poll. `createLazyHealthHandler` runs your callback on the first request
and reuses the handler it builds; with Hono, build the probe once inside a
route handler that receives `c.env` and memoise it the same way. The probe
calls `db.prepare("select 1").first()`, which round-trips to the D1 storage
and needs no table. For the colo and version the response came from, add
`@openstatus/health-cloudflare`'s `extend` hook.

```ts
d1Probe({
  db: env.DB,
  // optional overrides from the Probe contract
  name: "d1",
  critical: false,
  timeoutMs: 1000,
  skip: () => env.HEALTH_SKIP_D1 === "true",
});
```

The factory validates `db` when it is called, before `skip` is ever
consulted, so `skip` cannot stand in for a missing binding; leave the probe
out of `probes` instead when the Worker may run without D1.

Critical by default: a D1 that does not answer usually means requests cannot
be served, so the report turns `unhealthy`. Set `critical: false` when the
Worker can serve without it.

The binding is typed structurally as `{ prepare(query): { first() } }`, so
the package has no dependency on `@cloudflare/workers-types` and works with
the types `wrangler types` generates. The factory throws `ProbeConfigError`
at construction when the binding has no `prepare()`.

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
