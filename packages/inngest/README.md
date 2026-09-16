# @openstatus/health-inngest

[Inngest](https://www.inngest.com/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Sends
`GET {baseUrl}/v1/events?limit=1` to the Inngest REST API with your signing
key as a bearer header, so it proves both that Inngest answers and that the
key is valid — with `fetch` alone, on every runtime.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-inngest
npm install @openstatus/health @openstatus/health-inngest
```

```ts
import { createHealthHandler, readEnv } from "@openstatus/health";
import { inngestProbe } from "@openstatus/health-inngest";

const signingKey = readEnv("INNGEST_SIGNING_KEY");

Deno.serve(
  createHealthHandler({
    probes: [
      // the factory validates `signingKey` at construction, so pass a
      // placeholder and let `skip` keep the unconfigured check from running.
      inngestProbe({
        signingKey: signingKey ?? "unconfigured",
        skip: () => signingKey == null,
      }),
    ],
  }),
);
```

`signingKey` is the `INNGEST_SIGNING_KEY` of the environment you deploy to;
the REST API accepts it as a bearer token. `baseUrl` defaults to
`https://api.inngest.com` and takes the URL of a self-hosted Inngest server.
Like every probe here, this one never reads the environment itself — pass
the values in, and use `skip` for environments where Inngest is not
configured.

Listing one event is a cheap read that sends nothing, so the probe can run
on every health request without side effects. It checks the API your
functions are served from, not that a specific function is registered.

```ts
inngestProbe({
  signingKey,
  // optional overrides from the Probe contract
  name: "jobs",
  critical: true,
  timeoutMs: 2000,
  skip: () => env.INNGEST_SIGNING_KEY == null,
});
```

Non-critical by default: Inngest usually carries background work, so an
outage degrades the report instead of taking the service out of rotation.
Set `critical: true` when requests cannot complete without sending an event.

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
