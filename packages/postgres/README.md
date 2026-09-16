# @openstatus/health-postgres

[PostgreSQL](https://www.postgresql.org/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Runs `select 1`
through the client you already have — a [`pg`](https://node-postgres.com/)
pool or client, a [postgres.js](https://github.com/porsager/postgres) `sql`
instance, `@neondatabase/serverless` or `@vercel/postgres` — and fails the
check when the round trip does.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-postgres
npm install @openstatus/health @openstatus/health-postgres
```

```ts
import { Pool } from "pg";
import { createHealthHandler } from "@openstatus/health";
import { postgresProbe } from "@openstatus/health-postgres";

const pool = new Pool({ connectionString: env.DATABASE_URL });

Deno.serve(
  createHealthHandler({ probes: [postgresProbe({ client: pool })] }),
);
```

The probe picks the first method the client exposes:

| Client | Call |
| ------ | ---- |
| `pg` `Pool` / `Client`, `@vercel/postgres` `sql`, Neon `Pool` / `Client` / `neon()` | `client.query("select 1")` |
| postgres.js `sql` | `sql.unsafe("select 1")` |

Pass a pool rather than a single connection where you can: a pool checks a
connection out per probe and hands it back, so the health endpoint never
holds one open and never collides with request traffic on a shared client.

```ts
postgresProbe({
  client: pool,
  // optional overrides from the Probe contract
  name: "primary",
  critical: false,
  timeoutMs: 2000,
  skip: () => env.DATABASE_URL == null,
});
```

Critical by default: a Postgres that does not answer usually means requests
cannot be served, so the report turns `unhealthy` and the instance is taken
out of rotation. Set `critical: false` for a replica or reporting database.

The client is typed structurally as `{ query(text) }` or `{ unsafe(text) }`,
so `pg` and `postgres` are optional peer dependencies for their types only
and the probe adds no runtime import of either. The factory throws
`ProbeConfigError` at construction when the client has neither method.

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
