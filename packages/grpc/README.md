# @openstatus/health-grpc

gRPC probe for [`@openstatus/health`](https://jsr.io/@openstatus/health).
Calls the standard
[`grpc.health.v1.Health/Check`](https://github.com/grpc/grpc/blob/master/doc/health-checking.md)
method through a generated `@grpc/grpc-js` client and fails the check
unless the server answers `SERVING` — for every upstream that speaks gRPC
and implements the health protocol, which most do.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-grpc
npm install @openstatus/health @openstatus/health-grpc grpc-health-check @grpc/grpc-js
```

```ts
import { credentials } from "@grpc/grpc-js";
import { HealthClient } from "grpc-health-check";
import { createHealthHandler } from "@openstatus/health";
import { grpcProbe } from "@openstatus/health-grpc";

const client = new HealthClient(env.ORDERS_GRPC_ADDR, credentials.createInsecure());

Deno.serve(
  createHealthHandler({
    probes: [grpcProbe({ client, service: "orders.Orders" })],
  }),
);
```

Any client with `check(request, callback)` works: the `HealthClient` from
[`grpc-health-check`](https://github.com/grpc/grpc-node/tree/master/packages/grpc-health-check),
stubs generated from `health.proto` with `@grpc/proto-loader` or
`ts-proto`'s grpc-js output. `service` names the service to ask about;
the default empty string asks about the server as a whole. The probe
accepts the status as the enum number (`1`) or its name (`"SERVING"`),
whichever way the stubs were generated, and reports `NOT_SERVING`,
`SERVICE_UNKNOWN` or a transport error otherwise. A `timeoutMs` cancels
the call in flight. Reuse the client your application already holds: a
grpc-js channel reconnects on its own and one client per process is the
intended pattern.

```ts
grpcProbe({
  client,
  service: "orders.Orders",
  // optional overrides from the Probe contract
  name: "orders",
  critical: true,
  timeoutMs: 1000,
  skip: () => env.ORDERS_GRPC_ADDR == null,
});
```

Non-critical by default: an upstream that is down degrades the report
instead of taking this service out of rotation with it. Set
`critical: true` when requests cannot be served without that upstream.

The client is typed structurally as `{ check(request, callback) }`, so
`@grpc/grpc-js` is an optional peer dependency for its types only and the
probe adds no runtime import of it. The factory throws `ProbeConfigError`
at construction when the client has no `check()`.

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
