# @openstatus/health-algolia

[Algolia](https://www.algolia.com/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Sends
`GET /1/isalive` to your application's DSN host with the application ID and
an API key in the Algolia headers, so it proves both that the search API
answers and that the key is valid — with `fetch` alone, on every runtime.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-algolia
npm install @openstatus/health @openstatus/health-algolia
```

```ts
import { createHealthHandler, readEnv } from "@openstatus/health";
import { algoliaProbe } from "@openstatus/health-algolia";

const appId = readEnv("ALGOLIA_APP_ID");
const apiKey = readEnv("ALGOLIA_SEARCH_KEY");

Deno.serve(
  createHealthHandler({
    probes: [
      // the factory validates `appId` and `apiKey` at construction, so pass
      // placeholders and let `skip` keep the unconfigured check from running.
      algoliaProbe({
        appId: appId || "unconfigured",
        apiKey: apiKey || "unconfigured",
        skip: () => !appId || !apiKey,
      }),
    ],
  }),
);
```

`appId` is the application ID and `apiKey` any key of that application —
the search-only key is enough and is the least privilege that still
authenticates. The request goes to `https://{appId}-dsn.algolia.net`, the
DSN host that fans out across the application's cluster and the same one the
search client uses; pass `baseUrl` to target a specific replica instead.
`/1/isalive` is the endpoint Algolia documents for exactly this and has no
side effects, so the probe can run on every health request. Like every
probe here, this one never reads the environment itself — pass the values
in, and use `skip` for environments where Algolia is not configured.

```ts
algoliaProbe({
  appId: appId || "unconfigured",
  apiKey: apiKey || "unconfigured",
  // optional overrides from the Probe contract
  name: "algolia",
  critical: true,
  timeoutMs: 1000,
  skip: () => !appId || !apiKey,
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
