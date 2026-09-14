# @openstatus/health-clickhouse

[ClickHouse](https://clickhouse.com/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Runs the official
client's health-check request — a `SELECT 1` by default, so the server also
verifies your credentials — and fails the check when it comes back
unsuccessful.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-clickhouse
npm install @openstatus/health @openstatus/health-clickhouse
```

```ts
import { createClient } from "@clickhouse/client";
import { createHealthHandler } from "@openstatus/health";
import { clickhouseProbe } from "@openstatus/health-clickhouse";

const client = createClient({
  url: env.CLICKHOUSE_URL,
  username: env.CLICKHOUSE_USER,
  password: env.CLICKHOUSE_PASSWORD,
});

Deno.serve(
  createHealthHandler({ probes: [clickhouseProbe({ client })] }),
);
```

`client.ping()` resolves with `{ success: false, error }` instead of
throwing, which is easy to miss in a hand-written probe — this one turns that
into a failed check. The probe's `AbortSignal` is passed through as
`abort_signal`, so a `timeoutMs` actually cancels the request in flight.

`select` picks which request is sent:

| Option | Request | Verifies credentials | Runtimes |
| ------ | ------- | -------------------- | -------- |
| `select: true` (default) | `SELECT 1` | yes | Node.js, web/edge |
| `select: false` | `GET /ping` | no | Node.js only (no CORS) |

Use `select: false` when you want the cheapest possible liveness signal from
a self-hosted server; keep the default when the endpoint should also prove
that the credentials are good — on ClickHouse Cloud, where the default sends a
real query, that can also wake an idle service. Neither variant touches the
client's configured `database`, so a wrong database name is not caught here.

```ts
clickhouseProbe({
  client,
  select: false,
  // optional overrides from the Probe contract
  name: "analytics",
  critical: true,
  timeoutMs: 2000,
  skip: () => env.CLICKHOUSE_URL == null,
});
```

Non-critical by default: ClickHouse is usually the analytics store behind a
service rather than the database in its request path, so an outage degrades
the report instead of taking the service out of rotation. Set
`critical: true` when requests cannot be served without it.

The client is typed structurally as
`{ ping(params?): Promise<{ success: boolean, ... }> }`, so `@clickhouse/client`
is only a peer dependency for its types and the probe adds no runtime import
of it. It needs `@clickhouse/client` 1.12.0 or newer: earlier versions ignore
the argument to `ping()`, which silently drops both `select` and the abort
signal. `@clickhouse/client-web` works the same way — it always sends the
`SELECT` variant, so `select: false` has no effect there.

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
