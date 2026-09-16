# @openstatus/health-prisma

[Prisma](https://www.prisma.io/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Runs `select 1`
through `$queryRawUnsafe()` on every SQL connector — or the `ping` command
through `$runCommandRaw()` on MongoDB — and fails the check when the round
trip does.

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

The probe picks the first method the client exposes:

| Connector | Call |
| --------- | ---- |
| PostgreSQL, MySQL, SQLite, SQL Server, CockroachDB | `client.$queryRawUnsafe("select 1")` |
| MongoDB | `client.$runCommandRaw({ ping: 1 })` |

`$queryRawUnsafe` is used with a constant string only — nothing from the
request reaches it — and is the raw entry point that takes a plain string
rather than a tagged template. Prisma opens its connection pool lazily on the
first query, so the first probe after start-up also pays for the connect.

```ts
prismaProbe({
  client: prisma,
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
The factory throws `ProbeConfigError` at construction when the client has
neither method.

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
