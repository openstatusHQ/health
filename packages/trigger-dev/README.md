# @openstatus/health-trigger-dev

[Trigger.dev](https://trigger.dev/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Sends
`GET {baseUrl}/api/v1/runs?page[size]=1` to the Trigger.dev API with your
secret key as a bearer header, so it proves both that the API answers and
that the key is valid — with `fetch` alone, on every runtime.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-trigger-dev
npm install @openstatus/health @openstatus/health-trigger-dev
```

```ts
import { createHealthHandler, readEnv } from "@openstatus/health";
import { triggerDevProbe } from "@openstatus/health-trigger-dev";

const secretKey = readEnv("TRIGGER_SECRET_KEY");

Deno.serve(
  createHealthHandler({
    probes: [
      // the factory validates `secretKey` at construction, so pass a
      // placeholder and let `skip` keep the unconfigured check from running.
      triggerDevProbe({
        secretKey: secretKey || "unconfigured",
        skip: () => !secretKey,
      }),
    ],
  }),
);
```

`secretKey` is the `TRIGGER_SECRET_KEY` of the environment you deploy to
(`tr_dev_…` or `tr_prod_…`). `baseUrl` defaults to `https://api.trigger.dev`
and takes the `TRIGGER_API_URL` of a self-hosted instance. Like every probe
here, this one never reads the environment itself — pass the values in, and
use `skip` for environments where Trigger.dev is not configured.

Listing one run is a cheap read that triggers nothing, so the probe can run
on every health request without side effects. It checks the API your tasks
are triggered through, not that a worker is online to run them.

```ts
triggerDevProbe({
  secretKey,
  baseUrl: readEnv("TRIGGER_API_URL"), // self-hosted; undefined keeps the default
  // optional overrides from the Probe contract
  name: "jobs",
  critical: true,
  timeoutMs: 2000,
  skip: () => !secretKey,
});
```

Non-critical by default: Trigger.dev usually carries background work, so an
outage degrades the report instead of taking the service out of rotation.
Set `critical: true` when requests cannot complete without triggering a task.

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
