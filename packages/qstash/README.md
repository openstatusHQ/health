# @openstatus/health-qstash

[Upstash QStash](https://upstash.com/docs/qstash) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Sends
`GET {baseUrl}/v2/queues` with your token as a bearer header, so it proves
both that QStash answers and that the token is valid — with `fetch` alone,
on every runtime.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-qstash
npm install @openstatus/health @openstatus/health-qstash
```

```ts
import { createHealthHandler, readEnv } from "@openstatus/health";
import { qstashProbe } from "@openstatus/health-qstash";

const token = readEnv("QSTASH_TOKEN");

Deno.serve(
  createHealthHandler({
    probes: [
      // the factory validates `token` at construction, so pass a
      // placeholder and let `skip` keep the unconfigured check from running.
      qstashProbe({ token: token ?? "unconfigured", skip: () => token == null }),
    ],
  }),
);
```

`token` is the `QSTASH_TOKEN` the Upstash console gives you; `baseUrl`
defaults to `https://qstash.upstash.io` and takes the `QSTASH_URL` of a
regional or local development server. Like every probe here, this one never
reads the environment itself — pass the values in, and use `skip` for
environments where QStash is not configured.

Listing queues is a cheap read that needs no queue to exist and publishes
nothing, so the probe can run on every health request without side effects.

```ts
qstashProbe({
  token,
  baseUrl: "http://localhost:8080",
  // optional overrides from the Probe contract
  name: "queue",
  critical: true,
  timeoutMs: 2000,
  skip: () => token == null,
});
```

Non-critical by default: QStash usually carries background work, so an
outage degrades the report instead of taking the service out of rotation.
Set `critical: true` when requests cannot complete without enqueuing.

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
