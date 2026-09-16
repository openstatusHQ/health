# @openstatus/health-nats

[NATS](https://nats.io/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Flushes a
`NatsConnection` — one `PING` / `PONG` round trip with the server — and
fails the check when the server does not answer or the connection has been
closed.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-nats
npm install @openstatus/health @openstatus/health-nats
```

```ts
import { connect } from "@nats-io/transport-node";
import { createHealthHandler } from "@openstatus/health";
import { natsProbe } from "@openstatus/health-nats";

const nc = await connect({ servers: env.NATS_URL });

Deno.serve(
  createHealthHandler({ probes: [natsProbe({ connection: nc })] }),
);
```

Reuse the connection your application already holds: NATS clients keep one
multiplexed connection per process and reconnect on their own, so the probe
reports what your publishers and subscribers actually see. While the client
is reconnecting, `flush()` waits until the server is back — set `timeoutMs`
to bound that. Any of the official clients works: `@nats-io/transport-node`,
`@nats-io/transport-deno`, the websocket transport and the legacy `nats`
package all expose the same `flush()` and `isClosed()`.

```ts
natsProbe({
  connection: nc,
  // optional overrides from the Probe contract
  name: "events",
  critical: true,
  timeoutMs: 1000,
  skip: () => env.NATS_URL == null,
});
```

Non-critical by default: messaging usually carries background work, so an
outage degrades the report instead of taking the service out of rotation.
Set `critical: true` when requests cannot complete without publishing.

The connection is typed structurally as `{ flush(), isClosed?() }`, so the
NATS packages are optional peer dependencies for their types only and the
probe adds no runtime import of them. The factory throws `ProbeConfigError`
at construction when the connection has no `flush()`.

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
