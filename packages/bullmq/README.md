# @openstatus/health-bullmq

[BullMQ](https://bullmq.io/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Counts the
waiting jobs of a `Queue` — one `LLEN` against Redis — and fails the check
when Redis does not answer or, with `maxWaiting`, when the backlog grows
past a threshold.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-bullmq
npm install @openstatus/health @openstatus/health-bullmq
```

```ts
import { Queue } from "bullmq";
import { createHealthHandler } from "@openstatus/health";
import { bullmqProbe } from "@openstatus/health-bullmq";

const emails = new Queue("emails", { connection: { url: env.REDIS_URL } });

Deno.serve(
  createHealthHandler({
    probes: [bullmqProbe({ queue: emails, maxWaiting: 10_000 })],
  }),
);
```

Reuse the `Queue` your application already holds: BullMQ keeps a Redis
connection per `Queue`, so constructing one for the health endpoint would
add a connection of its own. Without `maxWaiting` the probe only proves the
queue's Redis is reachable; with it the check also turns `failed` when
producers outrun workers, which is usually the earlier warning.

```ts
bullmqProbe({
  queue: emails,
  maxWaiting: 10_000,
  // optional overrides from the Probe contract
  name: "emails",
  critical: true,
  timeoutMs: 1000,
  skip: () => env.REDIS_URL == null,
});
```

Non-critical by default: a queue usually carries background work, so an
outage or backlog degrades the report instead of taking the service out of
rotation. Set `critical: true` when requests cannot complete without
enqueuing.

The queue is typed structurally as `{ getWaitingCount(): PromiseLike<number> }`,
so `bullmq` is an optional peer dependency for its types only and the probe
adds no runtime import of it. The factory throws `ProbeConfigError` at
construction when the queue has no `getWaitingCount()` or `maxWaiting` is
negative.

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
