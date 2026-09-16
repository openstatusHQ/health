# @openstatus/health-sentry

[Sentry](https://sentry.io/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Sends
`GET {baseUrl}/api/0/`, the root of the Sentry web API, and fails the check
unless it answers 2xx — with `fetch` alone, on every runtime, against
sentry.io or your own instance.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-sentry
npm install @openstatus/health @openstatus/health-sentry
```

```ts
import { createHealthHandler, readEnv } from "@openstatus/health";
import { sentryProbe } from "@openstatus/health-sentry";

Deno.serve(
  createHealthHandler({
    probes: [sentryProbe({ token: readEnv("SENTRY_AUTH_TOKEN") })],
  }),
);
```

The API root answers without credentials, so the probe works with no
configuration against `https://sentry.io`. Pass `token` — an organization or
user auth token — to also verify that the token is accepted, and `baseUrl` for
a regional host (`https://de.sentry.io`) or a self-hosted instance. Like every
probe here, this one never reads the environment itself — pass the values in,
and use `skip` for environments where Sentry is not configured.

This proves the API Sentry's dashboard and integrations use is reachable.
Event ingestion goes to a separate host (your DSN's `oXXX.ingest.sentry.io`),
and the SDK queues and drops events on its own when that is down — it never
blocks a request — so an ingestion outage is invisible to this probe by
design.

```ts
sentryProbe({
  token,
  // optional overrides from the Probe contract
  name: "errors",
  critical: true,
  timeoutMs: 2000,
  skip: () => env.SENTRY_AUTH_TOKEN == null,
});
```

Non-critical by default: nothing in the request path depends on Sentry, so an
outage degrades the report instead of taking the service out of rotation.

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
