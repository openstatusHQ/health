# @openstatus/health-unkey

Reachability probe for [Unkey](https://www.unkey.com/) for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Checks
`GET {baseUrl}/v2/liveness`, unauthenticated — liveness is public.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-unkey
npm install @openstatus/health @openstatus/health-unkey
```

```ts
import { createHealthHandler } from "@openstatus/health";
import { unkeyProbe } from "@openstatus/health-unkey";

Deno.serve(
  createHealthHandler({ probes: [unkeyProbe()] }),
);
```

```ts
unkeyProbe({
  // optional: point at a self-hosted Unkey. Default https://api.unkey.com
  baseUrl: "https://api.unkey.com",
  // optional overrides from the Probe contract
  name: "auth",
  critical: true,
  timeoutMs: 3000,
  skip: () => !env.UNKEY_ENABLED,
});
```

Non-critical by default, so a dead Unkey degrades the report instead of
taking the whole service down. Override `critical: true` if Unkey is in the
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
