# @openstatus/health-resend

[Resend](https://resend.com/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Sends
`GET {baseUrl}/domains` with your API key as a bearer header, so it proves
both that the Resend API answers and that the key is valid — with `fetch`
alone, on every runtime.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-resend
npm install @openstatus/health @openstatus/health-resend
```

```ts
import { createHealthHandler, readEnv } from "@openstatus/health";
import { resendProbe } from "@openstatus/health-resend";

const apiKey = readEnv("RESEND_API_KEY");

Deno.serve(
  createHealthHandler({
    probes: [
      // the factory validates `apiKey` at construction, so pass a
      // placeholder and let `skip` keep the unconfigured check from running.
      resendProbe({
        apiKey: apiKey ?? "unconfigured",
        skip: () => apiKey == null,
      }),
    ],
  }),
);
```

`apiKey` is the `re_…` key from the Resend dashboard. Listing domains is a
read with no side effects — it sends no email and counts against no sending
quota — so the probe can run on every health request. `baseUrl` defaults to
`https://api.resend.com`. Like every probe here, this one never reads the
environment itself — pass the values in, and use `skip` for environments where
Resend is not configured.

```ts
resendProbe({
  apiKey,
  // optional overrides from the Probe contract
  name: "email",
  critical: true,
  timeoutMs: 2000,
  skip: () => env.RESEND_API_KEY == null,
});
```

Non-critical by default: email is usually sent after the request completes, so
an outage degrades the report instead of taking the service out of rotation.
Set `critical: true` when a request cannot succeed without sending.

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
