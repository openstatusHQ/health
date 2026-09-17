# @openstatus/health-neon

[Neon](https://neon.com/) serverless Postgres probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Runs `select 1`
through [`@neondatabase/serverless`](https://github.com/neondatabase/serverless)
— the HTTP `neon()` driver or the WebSocket `Pool` / `Client` — and fails the
check when the round trip does.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-neon
npm install @openstatus/health @openstatus/health-neon
```

```ts
import { neon } from "@neondatabase/serverless";
import { createHealthHandler } from "@openstatus/health";
import { neonProbe } from "@openstatus/health-neon";

const sql = neon(env.DATABASE_URL);

Deno.serve(
  createHealthHandler({ probes: [neonProbe({ client: sql })] }),
);
```

The HTTP driver is the best fit for a health endpoint: every probe is one
stateless `fetch`, nothing stays open between requests, and it runs on edge
runtimes; the probe's `AbortSignal` is passed as `fetchOptions.signal`, so
a `timeoutMs` cancels the request in flight. `Pool` and `Client` work the
same way — the probe calls `client.query("select 1")` on whichever you
pass — but their `query()` takes no signal, so a timed-out query runs to
completion on the connection. On a scale-to-zero branch
the first probe after idle also pays the compute wake-up, so give it a
`timeoutMs` that allows for it or point the probe at a branch that stays
warm.

```ts
neonProbe({
  client: sql,
  // optional overrides from the Probe contract
  name: "primary",
  critical: false,
  timeoutMs: 3000,
  skip: () => env.DATABASE_URL == null,
});
```

Critical by default: a Postgres that does not answer usually means requests
cannot be served, so the report turns `unhealthy` and the instance is taken
out of rotation. Set `critical: false` for a read replica or a branch that
only serves reporting.

The client is typed structurally as `{ query(text, params?, options?) }`, so
`@neondatabase/serverless` is an optional peer dependency for its types only
and the probe adds no runtime import of it. It needs `1.0.0` or newer, where
`neon()`'s `sql.query()` became a plain function call. The factory throws
`ProbeConfigError` at construction when the client has no `query()`.

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
