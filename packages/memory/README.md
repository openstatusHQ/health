# @openstatus/health-memory

Memory probe for [`@openstatus/health`](https://jsr.io/@openstatus/health).
Compares the process's heap in use with the V8 heap limit — and its
resident set size with a byte budget — and fails the check above either
threshold, so a leak turns the report `degraded` before the process is
killed for running out of memory.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-memory
npm install @openstatus/health @openstatus/health-memory
```

```ts
import { createHealthHandler } from "@openstatus/health";
import { memoryProbe } from "@openstatus/health-memory";

Deno.serve(
  createHealthHandler({
    probes: [memoryProbe({ maxHeapUsedPercent: 90 })],
  }),
);
```

The heap percentage is `heapUsed` from `process.memoryUsage()` over
`heap_size_limit` from `v8.getHeapStatistics()` — the limit V8 will
actually grow to, which honours `--max-old-space-size`. It is the number
that predicts an out-of-memory crash. `maxRssBytes` bounds the whole
resident set instead, which is what a container limit or an OOM killer
measures; set it a little under that limit. The check fails above
`maxHeapUsedPercent` (90% by default) or above `maxRssBytes` when that is
set instead; pass both to enforce both. A failing check throws
`MemoryPressureError`, which carries the `reading`, and a healthy one
reports `heapUsedBytes`, `heapLimitBytes`, `heapUsedPercent` and `rssBytes`.

```ts
memoryProbe({
  maxHeapUsedPercent: 85,
  maxRssBytes: 900 * 1024 * 1024,
  // optional overrides from the Probe contract
  name: "heap",
  critical: true,
  timeoutMs: 100,
  skip: () => env.NODE_ENV !== "production",
});
```

Non-critical by default: memory pressure is an alert to act on, and taking
a leaking instance out of rotation only shifts its traffic onto the others.
Set `critical: true` when your platform restarts unhealthy instances and
that is the recovery you want.

This probe uses `node:process` and `node:v8`, so it runs on Node.js, Deno
and Bun but not on edge runtimes. Both readers are typed structurally and
can be replaced for tests.

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
