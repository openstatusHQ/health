# @openstatus/health-drizzle

Database probe for [Drizzle ORM](https://orm.drizzle.team/) for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Runs a `select 1`
against your Drizzle instance. Critical by default.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-drizzle
npm install @openstatus/health @openstatus/health-drizzle
```

```ts
import { drizzle } from "drizzle-orm/libsql/http";
import { createHealthHandler } from "@openstatus/health";
import { drizzleProbe } from "@openstatus/health-drizzle";

const db = drizzle(env.DATABASE_URL, { authToken: env.DATABASE_TOKEN });

Deno.serve(
  createHealthHandler({ probes: [drizzleProbe({ db })] }),
);
```

The probe detects the driver: it calls `db.execute(sql\`select 1\`)` when
present (pg/mysql) and falls back to `db.run(sql\`select 1\`)`
(sqlite/libsql — what openstatus uses via `drizzle-orm/libsql/http`).
An instance with neither throws at construction.

```ts
drizzleProbe({
  db,
  name: "primary",
  timeoutMs: 3000,
  skip: () => env.DATABASE_NOOP === "true",
});
```

The only runtime import is `sql` from `drizzle-orm`; the db instance is typed
structurally, so older Drizzle versions work.
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
