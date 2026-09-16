# @openstatus/health-mysql

[MySQL](https://www.mysql.com/) / [MariaDB](https://mariadb.org/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Runs `select 1`
through a [`mysql2/promise`](https://sidorares.github.io/node-mysql2/docs)
pool or connection and fails the check when the round trip does.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-mysql
npm install @openstatus/health @openstatus/health-mysql
```

```ts
import { createPool } from "mysql2/promise";
import { createHealthHandler } from "@openstatus/health";
import { mysqlProbe } from "@openstatus/health-mysql";

const pool = createPool(env.DATABASE_URL);

Deno.serve(
  createHealthHandler({ probes: [mysqlProbe({ client: pool })] }),
);
```

Pass the promise API (`mysql2/promise`), not the callback one: the callback
`query()` returns a query object instead of a promise, which the probe
reports as a failed check rather than silently passing. Prefer a pool over
a single connection so the health endpoint never holds a connection open or
collides with request traffic.

```ts
mysqlProbe({
  client: pool,
  // optional overrides from the Probe contract
  name: "primary",
  critical: false,
  timeoutMs: 2000,
  skip: () => env.DATABASE_URL == null,
});
```

Critical by default: a MySQL that does not answer usually means requests
cannot be served, so the report turns `unhealthy` and the instance is taken
out of rotation. Set `critical: false` for a replica or reporting database.

The client is typed structurally as `{ query(sql): PromiseLike<...> }`, so
`mysql2` is an optional peer dependency for its types only and the probe adds
no runtime import of it. The factory throws `ProbeConfigError` at
construction when the client has no `query()`.

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
