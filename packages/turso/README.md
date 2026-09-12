# @openstatus/health-turso

Database probe for [Turso](https://turso.tech/) / libSQL for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Runs `select 1`
against your `@libsql/client` `Client`. Critical by default.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-turso
npm install @openstatus/health @openstatus/health-turso
```

```ts
import { createClient } from "@libsql/client";
import { createHealthHandler } from "@openstatus/health";
import { tursoProbe } from "@openstatus/health-turso";

const client = createClient({ url: env.TURSO_URL, authToken: env.TURSO_TOKEN });

Deno.serve(
  createHealthHandler({ probes: [tursoProbe({ client })] }),
);
```

A `select 1` never exhausts a pool or touches a table — just proves the
connection is alive. The client is typed structurally as
`{ execute(sql: string): Promise<ProbeResult> }`, so `@libsql/client` is only a
peer dependency for its types; the probe adds no runtime import of it.

```ts
tursoProbe({
  client,
  name: "turso-primary",
  timeoutMs: 3000,
  skip: () => env.TURSO_NOOP === "true",
});
```

Critical by default — a dead database takes the service out of rotation.
Override `critical: false` for read replicas.
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
