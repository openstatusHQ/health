# @openstatus/health-mongodb

[MongoDB](https://www.mongodb.com/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Runs the
[`ping`](https://www.mongodb.com/docs/manual/reference/command/ping/) command
through the official [`mongodb`](https://github.com/mongodb/node-mongodb-native)
driver and fails the check when the server does not answer.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-mongodb
npm install @openstatus/health @openstatus/health-mongodb
```

```ts
import { MongoClient } from "mongodb";
import { createHealthHandler } from "@openstatus/health";
import { mongodbProbe } from "@openstatus/health-mongodb";

const client = new MongoClient(env.MONGODB_URI);

Deno.serve(
  createHealthHandler({ probes: [mongodbProbe({ client })] }),
);
```

`ping` is the command MongoDB recommends for connectivity checks: it needs
no privileges beyond being authenticated, touches no collection and returns
as soon as the server selected by the driver responds. It runs against the
`admin` database by default; pass `db` to send the command to the database
your application uses. Note that `ping` does not verify the credentials can
read or write that database's collections.

```ts
mongodbProbe({
  client,
  db: "app",
  // optional overrides from the Probe contract
  name: "mongo",
  critical: false,
  timeoutMs: 2000,
  skip: () => env.MONGODB_URI == null,
});
```

Critical by default: a MongoDB that does not answer usually means requests
cannot be served, so the report turns `unhealthy` and the instance is taken
out of rotation. Set `critical: false` for a secondary or analytics cluster.

The client is typed structurally as `{ db(name?): { command({ ping: 1 }) } }`,
so `mongodb` is an optional peer dependency for its types only and the probe
adds no runtime import of it. The factory throws `ProbeConfigError` at
construction when the client has no `db()`.

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
