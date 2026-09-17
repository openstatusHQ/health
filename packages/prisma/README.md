# @openstatus/health-prisma

[Prisma](https://www.prisma.io/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Runs `select 1`
through `$queryRawUnsafe()` on every SQL connector — or the `ping` command
through `$runCommandRaw()` when `connector` is `"mongodb"` — and fails the
check when the round trip does.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-prisma
npm install @openstatus/health @openstatus/health-prisma
```

```ts
import { PrismaClient } from "@prisma/client";
import { createHealthHandler } from "@openstatus/health";
import { prismaProbe } from "@openstatus/health-prisma";

const prisma = new PrismaClient();

Deno.serve(
  createHealthHandler({ probes: [prismaProbe({ client: prisma })] }),
);
```

`connector` selects the call; it defaults to `"sql"`:

| `connector` | Connectors | Call |
| ----------- | ---------- | ---- |
| `"sql"` | PostgreSQL, MySQL, SQLite, SQL Server, CockroachDB | `client.$queryRawUnsafe("select 1")` |
| `"mongodb"` | MongoDB | `client.$runCommandRaw({ ping: 1 })` |

The choice is explicit rather than detected because Prisma's runtime defines
both methods on every generated client and only its type declarations hide
the one your connector does not support, so a MongoDB client would otherwise
be sent SQL.

`$queryRawUnsafe` is used with a constant string only — nothing from the
request reaches it — and is the raw entry point that takes a plain string
rather than a tagged template. Prisma opens its connection pool lazily on the
first query, so the first probe after start-up also pays for the connect.
Prisma's raw APIs take no `AbortSignal`, so a query that outlives
`timeoutMs` is reported as `timeout` but keeps its pooled connection busy
until the database answers; set a server-side statement timeout on the
database user if that matters.

```ts
prismaProbe({
  client: prisma,
  connector: "mongodb",
  // optional overrides from the Probe contract
  name: "primary",
  critical: false,
  timeoutMs: 2000,
  skip: () => env.DATABASE_URL == null,
});
```

Critical by default: a database that does not answer usually means requests
cannot be served, so the report turns `unhealthy` and the instance is taken
out of rotation. Set `critical: false` for a replica or reporting database.

The client is typed structurally as `{ $queryRawUnsafe(query) }` or
`{ $runCommandRaw(command) }`, so `@prisma/client` is an optional peer
dependency for its types only and the probe adds no runtime import of it.
The factory throws `ProbeConfigError` at construction when the client lacks
the method for the chosen `connector`.

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
