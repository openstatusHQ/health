# @openstatus/health-koyeb

Koyeb server metadata for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Renders the region,
instance and deployment that produced the response under a `server` key.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-koyeb
npm install @openstatus/health @openstatus/health-koyeb
```

```ts
import { createHealthHandler } from "@openstatus/health";
import { koyebExtend } from "@openstatus/health-koyeb";

const handler = createHealthHandler({
  probes: [/* ... */],
  extend: koyebExtend(),
});
```

```json
{
  "status": "ok",
  "checkedAt": "2026-09-11T12:00:00.000Z",
  "server": {
    "platform": "koyeb",
    "region": "fra",
    "instanceId": "e5f296b6-a911-8637-234e-f929e8bd5d87",
    "service": "my-service",
    "version": "3a1bb3d0-7502-40a5-ae12-7e28f807531b",
    "app": "app",
    "datacenter": "fra1",
    "replicaIndex": 0,
    "instanceType": "nano"
  }
}
```

## Fields

| Field | Environment variable |
| ----- | -------------------- |
| `region` | `KOYEB_REGION` |
| `instanceId` | `KOYEB_INSTANCE_ID` |
| `service` | `KOYEB_SERVICE_NAME` |
| `version` | `KOYEB_REGIONAL_DEPLOYMENT_ID` |
| `app` | `KOYEB_APP_NAME` |
| `datacenter` | `KOYEB_DC` — the specific facility inside the region |
| `replicaIndex` | `KOYEB_REPLICA_INDEX`, as a number |
| `instanceType` | `KOYEB_INSTANCE_TYPE` |

Koyeb sets sixteen variables; these eight are the ones that answer an
operational question. Deliberately left out: the app, service and organisation
UUIDs, `KOYEB_HYPERVISOR_ID`, and both the public and private domains — internal
identifiers and topology do not belong in a response anyone can poll. Koyeb has
no environment concept, so `environment` is absent rather than guessed.

`region` (`fra`) and `datacenter` (`fra1`) are different things: the second
tells you which facility in Frankfurt served you, which is what you want when
one replica is slow and the others are not.

## Off Koyeb

`koyebServer()` returns `undefined` when `KOYEB_INSTANCE_ID` is missing, and
`koyebExtend()` then renders no `server` key. The same build runs unchanged
locally, in CI and on Koyeb.

## Composing

```ts
extend: (_report, c) => ({
  server: koyebServer(),
  requestId: c.get("requestId"),
}),
```

Both functions accept `{ env }` to read from a record you supply instead of the
process environment.

## Public endpoints

`extend` output follows `exposeChecks`: when checks are hidden, `server` is
hidden too. One route can serve both audiences by gating on the request:

```ts
createHealthHandler({
  probes,
  exposeChecks: (req) => req.headers.get("x-health-token") === env.HEALTH_TOKEN,
  extend: koyebExtend(),
});
```

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
