# @openstatus/health-redis

[Redis](https://redis.io/) / [Valkey](https://valkey.io/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Sends `PING`
through the client you already have — [`redis`](https://github.com/redis/node-redis)
(node-redis), [`ioredis`](https://github.com/redis/ioredis),
[`@upstash/redis`](https://github.com/upstash/redis-js) or `@vercel/kv` — and
fails the check unless the server answers `PONG`.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-redis
npm install @openstatus/health @openstatus/health-redis
```

```ts
import { Redis } from "ioredis";
import { createHealthHandler } from "@openstatus/health";
import { redisProbe } from "@openstatus/health-redis";

const redis = new Redis(env.REDIS_URL);

Deno.serve(
  createHealthHandler({ probes: [redisProbe({ client: redis })] }),
);
```

Any object with `ping()` works, so the probe covers TCP clients against a
self-hosted Redis, Valkey, Railway, Fly or ElastiCache instance as well as
the HTTP clients from Upstash and Vercel. For an Upstash database without a
client, `@openstatus/health-upstash` pings the REST endpoint with `fetch`
alone.

With node-redis, connect the client before it is probed: `createClient()`
does not connect until `await client.connect()`, and a `ping()` on a closed
client rejects — which the probe reports as a failed check.

```ts
redisProbe({
  client: redis,
  // optional overrides from the Probe contract
  name: "cache",
  critical: true,
  timeoutMs: 1000,
  skip: () => env.REDIS_URL == null,
});
```

Non-critical by default: a Redis used as a cache degrades the report instead
of taking the service down. Set `critical: true` when Redis holds sessions,
queues or rate limits that requests cannot proceed without.

The client is typed structurally as `{ ping(): PromiseLike<...> }`, so
`redis` and `ioredis` are optional peer dependencies for their types only
and the probe adds no runtime import of either. The factory throws
`ProbeConfigError` at construction when the client has no `ping()`.

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
