# @openstatus/health-kafka

[Apache Kafka](https://kafka.apache.org/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Describes the
cluster through a connected [KafkaJS](https://kafka.js.org/)-style `Admin`
client — one metadata request to the broker — and fails the check when no
broker answers or the cluster reports none.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-kafka
npm install @openstatus/health @openstatus/health-kafka
```

```ts
import { Kafka } from "kafkajs";
import { createHealthHandler } from "@openstatus/health";
import { kafkaProbe } from "@openstatus/health-kafka";

const kafka = new Kafka({ brokers: env.KAFKA_BROKERS.split(",") });
const admin = kafka.admin();
await admin.connect();

Deno.serve(
  createHealthHandler({ probes: [kafkaProbe({ admin })] }),
);
```

Connect the `Admin` client once at start-up and keep it: KafkaJS only
sends the metadata request over an established connection, and creating
one per health request would add a broker handshake to every poll.
`describeCluster()` needs no topic and no ACL beyond `Describe` on the
cluster, so it works with the most restricted credentials. The
`@confluentinc/kafka-javascript` KafkaJS-compatible `Admin` exposes the same
method and works unchanged.

```ts
kafkaProbe({
  admin,
  // optional overrides from the Probe contract
  name: "events",
  critical: true,
  timeoutMs: 2000,
  skip: () => env.KAFKA_BROKERS == null,
});
```

Non-critical by default: Kafka usually carries events processed out of
band, so an outage degrades the report instead of taking the service out
of rotation. Set `critical: true` when requests cannot complete without
producing.

The admin client is typed structurally as
`{ describeCluster(): PromiseLike<{ brokers: [...] }> }`, so `kafkajs` and
`@confluentinc/kafka-javascript` are optional peer dependencies for their
types only and the probe adds no runtime import of them. The factory throws
`ProbeConfigError` at construction when the client has no
`describeCluster()`.

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
