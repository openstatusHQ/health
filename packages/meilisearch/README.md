# @openstatus/health-meilisearch

[Meilisearch](https://www.meilisearch.com/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Sends
`GET {host}/health` and fails the check unless the instance answers 2xx
with `{ "status": "available" }` — with `fetch` alone, on every runtime,
against Meilisearch Cloud or your own instance.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-meilisearch
npm install @openstatus/health @openstatus/health-meilisearch
```

```ts
import { createHealthHandler, readEnv } from "@openstatus/health";
import { meilisearchProbe } from "@openstatus/health-meilisearch";

const host = readEnv("MEILISEARCH_HOST");

Deno.serve(
  createHealthHandler({
    probes: [
      // the factory validates `host` at construction, so pass a placeholder
      // and let `skip` keep the unconfigured check from running.
      meilisearchProbe({
        host: host ?? "http://localhost:7700",
        skip: () => host == null,
      }),
    ],
  }),
);
```

`host` is the instance URL — `https://ms-xxx.meilisearch.io` on Cloud or
`http://localhost:7700` locally. `/health` is the endpoint Meilisearch
documents for exactly this: it needs no API key, has no side effects and
answers `available` only once the instance is ready to serve. Pass `apiKey`
to send one anyway when a proxy in front of the instance requires it. Like
every probe here, this one never reads the environment itself — pass the
values in, and use `skip` for environments where Meilisearch is not
configured.

```ts
meilisearchProbe({
  host,
  apiKey: env.MEILISEARCH_API_KEY,
  // optional overrides from the Probe contract
  name: "meili",
  critical: true,
  timeoutMs: 1000,
  skip: () => env.MEILISEARCH_HOST == null,
});
```

Non-critical by default: search is usually one feature of a service rather
than its request path, so an outage degrades the report instead of taking
the service out of rotation. Set `critical: true` when requests cannot be
served without it.

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
