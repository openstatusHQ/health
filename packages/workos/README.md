# @openstatus/health-workos

[WorkOS](https://workos.com/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Sends
`GET {baseUrl}/organizations?limit=1` with your API key as a bearer header, so
it proves both that the WorkOS API answers and that the key is valid — with
`fetch` alone, on every runtime.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-workos
npm install @openstatus/health @openstatus/health-workos
```

```ts
import { createHealthHandler, readEnv } from "@openstatus/health";
import { workosProbe } from "@openstatus/health-workos";

const apiKey = readEnv("WORKOS_API_KEY");

Deno.serve(
  createHealthHandler({
    probes: [
      // the factory validates `apiKey` at construction, so pass a
      // placeholder and let `skip` keep the unconfigured check from running.
      workosProbe({
        apiKey: apiKey || "unconfigured",
        skip: () => !apiKey,
      }),
    ],
  }),
);
```

`apiKey` is the `WORKOS_API_KEY` of the environment (`sk_test_…` or
`sk_live_…`). Listing one organization is the cheapest authenticated read on
the API and has no side effects, so the probe can run on every health request.
`baseUrl` defaults to `https://api.workos.com`. Like every probe here, this
one never reads the environment itself — pass the values in, and use `skip`
for environments where WorkOS is not configured.

```ts
workosProbe({
  apiKey,
  // optional overrides from the Probe contract
  name: "auth",
  critical: true,
  timeoutMs: 2000,
  skip: () => !apiKey,
});
```

Non-critical by default, since AuthKit sessions are verified locally with the
environment's JWKS and most requests never call the API. Set `critical: true`
when requests cannot be served without it — SSO and Directory Sync lookups, or
a login flow that is the whole service.

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
