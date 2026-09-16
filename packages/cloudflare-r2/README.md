# @openstatus/health-cloudflare-r2

[Cloudflare R2](https://developers.cloudflare.com/r2/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Sends a `HEAD`
for one object through an `R2Bucket` binding and fails the check when the
request does — a missing object is a healthy answer, only an error is not.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-cloudflare-r2
npm install @openstatus/health @openstatus/health-cloudflare-r2
```

```ts
import { createHealthHandler } from "@openstatus/health";
import { r2Probe } from "@openstatus/health-cloudflare-r2";

interface Env {
  UPLOADS: R2Bucket;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const handler = createHealthHandler({
      path: "/health",
      probes: [r2Probe({ bucket: env.UPLOADS })],
    });
    return handler(request);
  },
};
```

Bindings only exist per request in Workers, so build the probe inside
`fetch` — or, with Hono, inside a route handler that receives `c.env`. The
probe calls `bucket.head("health")`, the cheapest R2 operation that still
reaches the bucket; pass `key` to check an object your Worker actually
serves. For an R2 bucket reached over its S3 API from outside Workers, use
`@openstatus/health-s3` instead.

```ts
r2Probe({
  bucket: env.UPLOADS,
  key: "assets/logo.png",
  // optional overrides from the Probe contract
  name: "uploads",
  critical: true,
  timeoutMs: 1000,
  skip: () => env.UPLOADS == null,
});
```

Non-critical by default: object storage usually backs uploads and assets
whose outage degrades the report instead of taking the Worker out of
rotation. Set `critical: true` when requests cannot proceed without it.

The binding is typed structurally as `{ head(key) }`, so the package has no
dependency on `@cloudflare/workers-types` and works with the types
`wrangler types` generates. The factory throws `ProbeConfigError` at
construction when the binding has no `head()` or `key` is empty.

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
