# @openstatus/health-cloudflare-kv

[Cloudflare Workers KV](https://developers.cloudflare.com/kv/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Reads one key
through a `KVNamespace` binding and fails the check when the read does — a
missing key is a healthy answer, only an error is not.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-cloudflare-kv
npm install @openstatus/health @openstatus/health-cloudflare-kv
```

```ts
import { createHealthHandler } from "@openstatus/health";
import { kvProbe } from "@openstatus/health-cloudflare-kv";

interface Env {
  CACHE: KVNamespace;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const handler = createHealthHandler({
      path: "/health",
      probes: [kvProbe({ namespace: env.CACHE })],
    });
    return handler(request);
  },
};
```

Bindings only exist per request in Workers, so build the probe inside
`fetch` — or, with Hono, inside a route handler that receives `c.env`. The
probe calls `namespace.get("health")`; pass `key` to read a key your Worker
actually depends on. KV reads are served from the edge cache, so a
successful probe proves the binding and the nearest cache answer, not that
a write would reach the origin.

```ts
kvProbe({
  namespace: env.CACHE,
  key: "config:v1",
  // optional overrides from the Probe contract
  name: "sessions",
  critical: true,
  timeoutMs: 1000,
  skip: () => env.CACHE == null,
});
```

Non-critical by default: KV is usually a cache or configuration store whose
outage degrades the report instead of taking the Worker out of rotation.
Set `critical: true` when requests cannot proceed without it.

The binding is typed structurally as `{ get(key) }`, so the package has no
dependency on `@cloudflare/workers-types` and works with the types
`wrangler types` generates. The factory throws `ProbeConfigError` at
construction when the binding has no `get()` or `key` is empty.

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
