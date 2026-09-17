# @openstatus/health-convex

[Convex](https://www.convex.dev/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Runs one query
function of your deployment over its
[HTTP API](https://docs.convex.dev/http-api/) — `POST {url}/api/query` —
and fails the check unless it answers `status: "success"`. With `fetch`
alone, on every runtime, and without the Convex client.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-convex
npm install @openstatus/health @openstatus/health-convex
```

Add a trivial query to your `convex/` directory once:

```ts
// convex/health.ts
import { query } from "./_generated/server";

export const ping = query({
  args: {},
  handler: () => "pong",
});
```

Then point the probe at it:

```ts
import { createHealthHandler, readEnv } from "@openstatus/health";
import { convexProbe } from "@openstatus/health-convex";

const url = readEnv("CONVEX_URL");

Deno.serve(
  createHealthHandler({
    probes: [
      // the factory validates `url` at construction, so pass a placeholder
      // and let `skip` keep the unconfigured check from running.
      convexProbe({
        url: url ?? "https://unconfigured.convex.cloud",
        path: "health:ping",
        skip: () => url == null,
      }),
    ],
  }),
);
```

`url` is the deployment URL (`CONVEX_URL` / `NEXT_PUBLIC_CONVEX_URL`, the
`.convex.cloud` host — not the `.convex.site` host of HTTP actions).
`path` names the function as `module:function`. A query is read-only and
runs inside the deployment, so a success proves the deployment, its
database and your code are all up. Pass `args` for a query that takes
them, and `token` — a deploy key or a user's JWT — when the query checks
authentication. Like every probe here, this one never reads the environment
itself — pass the values in, and use `skip` for environments where Convex
is not configured.

```ts
convexProbe({
  url,
  path: "health:ping",
  // optional overrides from the Probe contract
  name: "convex",
  critical: false,
  timeoutMs: 2000,
  skip: () => env.CONVEX_URL == null,
});
```

Critical by default: Convex is usually the application's database, so a
deployment that does not answer turns the report `unhealthy` and takes the
instance out of rotation. Set `critical: false` when the service can serve
without it.

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
