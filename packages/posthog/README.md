# @openstatus/health-posthog

[PostHog](https://posthog.com/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Sends
`GET {baseUrl}/api/projects/@current/` with a personal API key as a bearer
header, so it proves both that the PostHog API answers and that the key is
valid — with `fetch` alone, on every runtime.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-posthog
npm install @openstatus/health @openstatus/health-posthog
```

```ts
import { createHealthHandler, readEnv } from "@openstatus/health";
import { posthogProbe } from "@openstatus/health-posthog";

const personalApiKey = readEnv("POSTHOG_PERSONAL_API_KEY");

Deno.serve(
  createHealthHandler({
    probes: [
      // the factory validates `personalApiKey` at construction, so pass a
      // placeholder and let `skip` keep the unconfigured check from running.
      posthogProbe({
        personalApiKey: personalApiKey ?? "unconfigured",
        skip: () => personalApiKey == null,
      }),
    ],
  }),
);
```

`personalApiKey` is a `phx_…` personal API key with the `project:read` scope —
not the `phc_…` project token the browser SDK uses, which cannot call the
private API. Reading the current project is a cheap read with no side effects,
so the probe can run on every health request. `baseUrl` defaults to
`https://us.posthog.com`; pass `https://eu.posthog.com` for EU Cloud or the
URL of a self-hosted instance. Like every probe here, this one never reads the
environment itself — pass the values in, and use `skip` for environments where
PostHog is not configured.

This proves the API your server calls for feature-flag definitions and queries
is reachable. Event capture goes to the ingestion host (`us.i.posthog.com` /
`eu.i.posthog.com`), which the SDKs buffer and retry on their own.

```ts
posthogProbe({
  personalApiKey,
  // optional overrides from the Probe contract
  name: "analytics",
  critical: true,
  timeoutMs: 2000,
  skip: () => env.POSTHOG_PERSONAL_API_KEY == null,
});
```

Non-critical by default: analytics and feature flags are evaluated from cached
definitions, so an outage degrades the report instead of taking the service
out of rotation. Set `critical: true` when requests block on a live flag
evaluation.

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
