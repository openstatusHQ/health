# @openstatus/health-planetscale

[PlanetScale](https://planetscale.com/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Runs `select 1`
over the serverless HTTP driver,
[`@planetscale/database`](https://github.com/planetscale/database-js), and
fails the check when the round trip does.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-planetscale
npm install @openstatus/health @openstatus/health-planetscale
```

```ts
import { connect } from "@planetscale/database";
import { createHealthHandler } from "@openstatus/health";
import { planetscaleProbe } from "@openstatus/health-planetscale";

const connection = connect({ url: env.DATABASE_URL });

Deno.serve(
  createHealthHandler({
    probes: [planetscaleProbe({ connection })],
  }),
);
```

Every probe is one stateless `fetch` against PlanetScale's HTTP API, so
nothing stays open between health requests and the probe runs on edge
runtimes. A `Client` from the same package works too — the probe only calls
`execute("select 1")`. The driver's `execute()` takes no `AbortSignal`, so a
check that outlives `timeoutMs` is reported `timeout` while the HTTP request
runs to completion in the background; pass a `fetch` with its own deadline to
`connect()` if that matters. For a PlanetScale database reached through
`mysql2` instead, use `@openstatus/health-mysql`.

```ts
planetscaleProbe({
  connection,
  // optional overrides from the Probe contract
  name: "primary",
  critical: false,
  timeoutMs: 2000,
  skip: () => env.DATABASE_URL == null,
});
```

Critical by default: a database that does not answer usually means requests
cannot be served, so the report turns `unhealthy` and the instance is taken
out of rotation. Set `critical: false` for a replica or reporting database.

The connection is typed structurally as `{ execute(query): PromiseLike<...> }`,
so `@planetscale/database` is an optional peer dependency for its types only
and the probe adds no runtime import of it. The factory throws
`ProbeConfigError` at construction when the connection has no `execute()`.

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
