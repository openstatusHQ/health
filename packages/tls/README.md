# @openstatus/health-tls

TLS probe for [`@openstatus/health`](https://jsr.io/@openstatus/health).
Completes a TLS handshake with `host:port`, requires the certificate to
chain to a trusted CA and fails the check when it expires within
`minDaysValid` days — so a certificate that is about to lapse turns the
report `degraded` two weeks before browsers start refusing it.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-tls
npm install @openstatus/health @openstatus/health-tls
```

```ts
import { createHealthHandler } from "@openstatus/health";
import { tlsProbe } from "@openstatus/health-tls";

Deno.serve(
  createHealthHandler({
    probes: [
      tlsProbe({ host: "api.example.com" }),
      tlsProbe({ name: "db-tls", host: "db.example.com", port: 5432 }),
    ],
  }),
);
```

`host` is sent as the SNI server name, so the probe sees the same
certificate a client would. The socket is closed as soon as the handshake
completes; no application data is sent. A self-signed or mis-chained
certificate fails with the runtime's verification error
(`SELF_SIGNED_CERT_IN_CHAIN`, `CERT_HAS_EXPIRED`, …), and one that is
about to expire fails with `TlsCertificateExpiryError`, which carries
`expiresAt` and `daysLeft`.

Point it at your own public hostname to catch a renewal that did not run,
or at a dependency to be warned before its certificate takes you down.
Give each probe a `name` when you mount more than one.

```ts
tlsProbe({
  host: "api.example.com",
  port: 443,
  minDaysValid: 30,
  // optional overrides from the Probe contract
  name: "certificate",
  critical: false,
  timeoutMs: 3000,
  skip: () => env.NODE_ENV !== "production",
});
```

Non-critical by default: an expiring certificate is something to act on,
not a reason to take the instance out of rotation today. Set
`critical: true` when the handshake is with a dependency requests cannot
proceed without.

This probe uses `node:tls`, so it runs on Node.js, Deno and Bun but not on
edge runtimes without a socket API. `connect` is typed structurally and can
be replaced for tests.

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
