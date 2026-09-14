# @openstatus/health-vercel

Vercel server metadata for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Renders the region,
environment and deployment that produced the response under a `server` key.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-vercel
npm install @openstatus/health @openstatus/health-vercel
```

```ts
// app/health/route.ts
import { healthRoute } from "@openstatus/health-next";
import { vercelExtend } from "@openstatus/health-vercel";

export const dynamic = "force-dynamic";

export const { GET, HEAD } = healthRoute({
  probes: [/* ... */],
  extend: vercelExtend(),
});
```

```json
{
  "status": "ok",
  "checkedAt": "2026-09-11T12:00:00.000Z",
  "server": {
    "platform": "vercel",
    "region": "cdg1",
    "environment": "production",
    "version": "dpl_7Gw5ZMBpQA8h9GF832KGp7nwbuh3",
    "projectId": "prj_Rej9WaMNRbffVm34MfDqa4daCEvZzzE",
    "commitSha": "fa1eade47b73733d6312d5abfad33ce9e4068081",
    "branch": "improve-about-page"
  }
}
```

## Fields

| Field | Environment variable |
| ----- | -------------------- |
| `region` | `VERCEL_REGION` |
| `environment` | `VERCEL_ENV` — `production`, `preview` or `development` |
| `version` | `VERCEL_DEPLOYMENT_ID` |
| `projectId` | `VERCEL_PROJECT_ID` |
| `targetEnvironment` | `VERCEL_TARGET_ENV`, for custom environments |
| `commitSha` | `VERCEL_GIT_COMMIT_SHA` |
| `branch` | `VERCEL_GIT_COMMIT_REF` |

**No `service`, and no `instanceId`.** Both omissions are deliberate. The other
hosting packages put a human-readable name in `service`, and Vercel exposes only
`VERCEL_PROJECT_ID` — an opaque `prj_…` handle — so it renders under its own
name instead of pretending to be something it is not. Vercel exposes no
per-instance identity at all; the `x-vercel-id` header is a request id, which
belongs alongside your own trace fields rather than in `server`:

```ts
extend: (_report, req) => ({
  server: vercelServer(),
  requestId: req.headers.get("x-vercel-id"),
}),
```

## Two things that make `server` come back thin

**System environment variables must be enabled** in Project Settings →
Environment Variables. Without that, none of these exist and you will see
`{"platform": "vercel"}` alone — or nothing at all, if even `VERCEL` is unset.

**`VERCEL_REGION` is runtime-only.** It is absent during the build, so a value
captured at module scope on a prerendered route is `undefined`. This package
reads lazily on the first request and caches after that, which is why
`export const dynamic = "force-dynamic"` matters on a Next.js route.

## Off Vercel

`vercelServer()` returns `undefined` unless `VERCEL` is set, and
`vercelExtend()` then renders no `server` key. Both accept `{ env }` to read
from a record you supply instead of the process environment.

## Public endpoints

`extend` output follows `exposeChecks`: when checks are hidden, `server` is
hidden too, so deployment ids and branch names are never shown to anonymous
callers. Pass a function as `exposeChecks` to decide per request.

To publish part of `server` but not all of it, both functions take a typed
`omit` list and drop those keys before anything is rendered:

```ts
extend: vercelExtend({ omit: ["projectId", "commitSha"] }),
```

The keys are checked against `VercelServerInfo`, so `"projectID"` is a compile
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
