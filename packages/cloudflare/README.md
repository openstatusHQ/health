# @openstatus/health-cloudflare

Cloudflare Workers server metadata for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Renders the colo that
served the request, and the Worker version when you supply the binding, under a
`server` key.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-cloudflare
npm install @openstatus/health @openstatus/health-cloudflare
```

```ts
import { createLazyHealthHandler } from "@openstatus/health";
import { cloudflareExtend } from "@openstatus/health-cloudflare";

export default {
  fetch: createLazyHealthHandler<Request, Env>((env) => ({
    probes: [/* ... */],
    extend: cloudflareExtend({ version: env.CF_VERSION_METADATA }),
  })),
};
```

```json
{
  "status": "ok",
  "checkedAt": "2026-09-11T12:00:00.000Z",
  "server": {
    "platform": "cloudflare",
    "region": "DFW",
    "version": "45f6ad3c-8f1e-4c2b-9d11-2a7c5f0e3b88",
    "versionTag": "v3"
  }
}
```

## Build the handler once

Bindings only exist inside `fetch(request, env)`, but the handler must be built
once — construct it per request and every request gets a fresh cache, so
`cacheMs` never de-duplicates anything and your probes run on every poll.
`createLazyHealthHandler` does the bookkeeping: your callback runs on the first
request, when `env` is finally in scope, and the handler it builds is reused
after that. It is the same as `createHealthHandler` in every other respect.

## Fields

| Field | Source |
| ----- | ------ |
| `region` | `request.cf.colo` — the IATA code of the data centre that served the request |
| `version` | `CF_VERSION_METADATA.id`, when the binding is passed |
| `versionTag` | `CF_VERSION_METADATA.tag`, when the binding is passed |

Add the binding in `wrangler.jsonc`:

```jsonc
{ "version_metadata": { "binding": "CF_VERSION_METADATA" } }
```

There is no `instanceId`: isolates are not addressable, so the field is absent
rather than invented.

**Client geolocation is never rendered.** `request.cf` also carries `country`,
`city`, `latitude`, `longitude` and a `region` — those describe whoever called
you, not where you ran, and `cf.region` ("Texas") means something different from
the `region` in this body (the colo). None of them appear under `server`, and a
test enforces it. If you want caller geography, put it in your own `extend`
under your own key.

## Reaching the request

Unlike the other hosting packages, this one reads the request rather than the
environment, so it needs to know how to get it from whatever your adapter hands
`extend`. By default the context *is* the request:

```ts
extend: cloudflareExtend(),                                // Workers fetch, Next.js
extend: cloudflareExtend({ request: (c) => c.req.raw }),   // Hono
extend: cloudflareExtend({ request: (c) => c.request }),   // Elysia
```

Or call `cloudflareServer(request)` yourself and compose:

```ts
extend: (_report, c) => ({
  server: cloudflareServer(c.req.raw, { version: c.env.CF_VERSION_METADATA }),
  rayId: c.req.header("cf-ray"),
}),
```

Nothing is memoised here, deliberately: the colo is a property of the request,
not of the isolate, and two requests to the same Worker can be served by
different data centres.

## Off Workers

`cloudflareServer()` returns `undefined` when the request carries no `cf`
object, and the extend then renders no `server` key — so `wrangler dev`, local
Node runs and tests all behave the same way without branching.

## Public endpoints

`extend` output follows `exposeChecks`: when checks are hidden, `server` is
hidden too. The colo is harmless to publish, the version id tells anyone
polling exactly which build you are running — pass a function as
`exposeChecks` to show the detailed body only to callers you trust.

To keep the colo but hide the build, both functions take a typed `omit` list:

```ts
cloudflareExtend({ version, omit: ["version"] })
```

The keys are checked against `CloudflareServerInfo`, so `"colo"` is a compile
error, and `platform` may be omitted too when you would rather not advertise
the host.

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
