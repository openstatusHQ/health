# @openstatus/health-upstash

Redis probe for [Upstash](https://upstash.com/) for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Sends
`GET {url}/ping` over the REST API with the token as a bearer header, so it
needs no Redis client and runs on every runtime `fetch` does.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-upstash
npm install @openstatus/health @openstatus/health-upstash
```

```ts
import { createHealthHandler, readEnv } from "@openstatus/health";
import { upstashProbe } from "@openstatus/health-upstash";

Deno.serve(
  createHealthHandler({
    probes: [
      upstashProbe({
        url: readEnv("UPSTASH_REDIS_REST_URL") ?? "",
        token: readEnv("UPSTASH_REDIS_REST_TOKEN") ?? "",
        skip: () => readEnv("UPSTASH_REDIS_REST_URL") == null,
      }),
    ],
  }),
);
```

`url` and `token` are the `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
pair the Upstash console gives you. Like every probe here, this one never
reads the environment itself — pass the values in, and use `skip` for
environments where Redis is not configured.

```ts
upstashProbe({
  url,
  token,
  // optional overrides from the Probe contract
  name: "cache",
  critical: true,
  timeoutMs: 1000,
  skip: () => env.CACHE_DISABLED === "true",
});
```

Non-critical by default: a Redis used as a cache degrades the report instead
of taking the service down. Set `critical: true` when Redis holds sessions or
rate limits that requests cannot proceed without.

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
