# @openstatus/health-typesense

[Typesense](https://typesense.org/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Sends
`GET {host}/health` and fails the check unless the node answers 2xx with
`{ "ok": true }` — with `fetch` alone, on every runtime, against Typesense
Cloud or your own cluster.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-typesense
npm install @openstatus/health @openstatus/health-typesense
```

```ts
import { createHealthHandler, readEnv } from "@openstatus/health";
import { typesenseProbe } from "@openstatus/health-typesense";

const host = readEnv("TYPESENSE_HOST");

Deno.serve(
  createHealthHandler({
    probes: [
      // the factory validates `host` at construction, so pass a placeholder
      // and let `skip` keep the unconfigured check from running.
      typesenseProbe({
        host: host ?? "http://localhost:8108",
        skip: () => host == null,
      }),
    ],
  }),
);
```

`host` is a node URL — `https://xxx.a1.typesense.net` on Cloud or
`http://localhost:8108` locally. `/health` is the endpoint Typesense
documents for exactly this: it needs no API key, has no side effects and
answers `ok: false` while the node is still catching up on a cluster, which
the probe reports as a failed check. Pass `apiKey` to send one anyway when a
proxy in front of the node requires it. Like every probe here, this one
never reads the environment itself — pass the values in, and use `skip` for
environments where Typesense is not configured.

```ts
typesenseProbe({
  host,
  apiKey: env.TYPESENSE_API_KEY,
  // optional overrides from the Probe contract
  name: "typesense",
  critical: true,
  timeoutMs: 1000,
  skip: () => env.TYPESENSE_HOST == null,
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
