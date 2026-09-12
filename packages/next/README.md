# @openstatus/health-next

Next.js App Router adapter for
[`@openstatus/health`](https://jsr.io/@openstatus/health).

```sh
npm install @openstatus/health @openstatus/health-next
```

```ts
// app/health/route.ts
import { healthRoute } from "@openstatus/health-next";
import { drizzleProbe } from "@openstatus/health-drizzle";
import { db } from "@/lib/db";

// required: keeps Next.js from statically caching the route
export const dynamic = "force-dynamic";

export const { GET, HEAD } = healthRoute({
  probes: [drizzleProbe({ db })],
  extend: (_report, req) => ({ requestId: req.headers.get("x-request-id") }),
});
```

`export const dynamic = "force-dynamic"` keeps Next.js from statically caching
the route; `cacheMs` (default 5 s) is the only cache that should apply.

The route path is the file location, so there is no `path` option. `extend`
and a function-form `exposeChecks` receive the `NextRequest`; pass `check`
instead of `probes` to share one `createHealthCheck()` with another route. `next` is a types-only peer dependency, so the
package has no runtime imports and works on the Edge runtime.

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
