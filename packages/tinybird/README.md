# @openstatus/health-tinybird

Reachability probe for [Tinybird](https://www.tinybird.co/) for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Checks
`GET {baseUrl}/v0/health`, unauthenticated.

Tinybird's `/v0/health` endpoint is public and answers without a token.
Workspace tokens **403 on `/v0/pipes`**, so an authenticated probe would flag
a perfectly healthy Tinybird as down. Use this unauthenticated reachability
check and keep real failure detection to your queries.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-tinybird
npm install @openstatus/health @openstatus/health-tinybird
```

```ts
import { createHealthHandler } from "@openstatus/health";
import { tinybirdProbe } from "@openstatus/health-tinybird";

Deno.serve(
  createHealthHandler({
    probes: [
      tinybirdProbe({
        // self-hosted or EU region, e.g. env.TINYBIRD_URL
        baseUrl: "https://api.tinybird.co",
        skip: () => env.TINYBIRD_NOOP === "true",
      }),
    ],
  }),
);
```

Non-critical by default. Override `critical: true` when events are in the
request path.
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
